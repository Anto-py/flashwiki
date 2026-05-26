# flash_wiki — plan.md

## Résumé de l'architecture

- **2 containers Docker** : `flash-wiki-app` (Node.js/Express + React build statique) + `flash-wiki-db` (PostgreSQL 16 Alpine)
- **Déploiement** : Coolify sur VPS Hostinger (`flash.antoninbareau.eu`)
- **Pipeline** : workflow n8n hebdomadaire (déjà installé sur le VPS)
- **Pas de Prisma**, pas de Next.js, pas de ORM — SQL brut avec `pg`, migrations au démarrage
- **Frontend** : React + Vite, build copié dans l'image backend (un seul container applicatif)

---

## Arborescence complète

```
flash_wiki/
├── docs/                          # Fichiers de conception (déjà créés)
│   ├── idea.md
│   ├── brainstorming.md
│   └── plan.md
├── .env.example                   # Variables d'environnement à copier
├── docker-compose.yml             # Compose local (dev/test)
├── Dockerfile                     # Multi-stage : build frontend → image finale
├── backend/
│   ├── package.json               # Dépendances : express, pg, ts-fsrs, cors, helmet
│   ├── server.js                  # Entry point Express — monte les routes + sert le build Vite
│   ├── db/
│   │   ├── client.js              # Pool PostgreSQL (singleton)
│   │   └── migrate.js             # Exécute les migrations SQL au démarrage
│   ├── migrations/
│   │   └── 001_init.sql           # Schéma initial : wiki_files, cards, user_settings, review_log
│   ├── routes/
│   │   ├── dashboard.js           # GET /api/dashboard
│   │   ├── session.js             # GET /api/session/cards, POST /api/cards/:id/rate
│   │   ├── summary.js             # GET /api/session/summary
│   │   └── settings.js            # GET /api/settings, PUT /api/settings
│   └── lib/
│       └── fsrs.js                # Wrapper ts-fsrs : calcul du prochain intervalle après rating
└── frontend/
    ├── package.json               # Dépendances : react, react-dom, react-router-dom, vite-plugin-pwa
    ├── vite.config.js             # Config Vite + PWA plugin (manifest, service worker)
    ├── index.html
    ├── public/
    │   ├── icon-192.png           # Icône PWA 192×192 (requise par vite-plugin-pwa)
    │   └── icon-512.png           # Icône PWA 512×512
    └── src/
        ├── main.jsx               # Mount React + BrowserRouter
        ├── App.jsx                # Routes React Router : /, /review, /summary, /settings
        ├── api/
        │   └── client.js          # fetch wrapper avec base URL et gestion d'erreurs
        ├── hooks/
        │   └── useOfflineQueue.js # Queue IndexedDB pour les ratings hors ligne
        ├── screens/
        │   ├── DashboardScreen.jsx   # Écran d'accueil : stats, boutons, liste thèmes
        │   ├── ReviewScreen.jsx      # Session de révision : carte flip + 4 boutons rating
        │   ├── SummaryScreen.jsx     # Fin de session : feedback de maîtrise
        │   └── SettingsScreen.jsx    # Paramètre "nouvelles cartes par jour"
        └── components/
            ├── Card.jsx           # Carte flipable (recto/verso + cloze) avec animation CSS 3D
            ├── ThemeList.jsx      # Liste des thèmes wiki avec cartes dues + barre progression
            └── WeekDots.jsx       # 7 points indicateur semaine (sans streak punitif)
```

---

## Contenu de chaque fichier

### `docker-compose.yml`
- Services : `db` (postgres:16-alpine, port 5432, volume nommé `pgdata`) + `app` (build depuis Dockerfile, port 3000, dépend de `db`)
- Variables injectées depuis `.env`
- Réseau interne `flash-net`

### `.env.example`
```
DATABASE_URL=postgresql://flash:secret@db:5432/flashwiki
ANTHROPIC_API_KEY=
GITHUB_TOKEN=
GITHUB_REPO=username/vault
PORT=3000
```

### `Dockerfile` (multi-stage, 3 stages)
```
Stage 1 — frontend-builder : node:20-alpine, npm ci, npm run build → produit /app/dist
Stage 2 — backend-deps     : node:20-alpine, npm ci --omit=dev (backend only)
Stage 3 — runner           : node:20-alpine, copie backend-deps + frontend build dans /app/public
                              CMD : node db/migrate.js && node server.js
```
Résultat : image finale ~120 Mo (vs ~800 Mo pour Abbadaba avec Next.js).

### `backend/db/client.js`
- Exporte un Pool `pg` configuré depuis `DATABASE_URL`
- Retry de connexion (5 tentatives, backoff 2 s) pour tolérer le démarrage lent de PostgreSQL

### `backend/db/migrate.js`
- Lit tous les fichiers `*.sql` dans `migrations/` par ordre alphabétique
- Les exécute séquentiellement via le Pool
- Idempotent : chaque migration utilise `CREATE TABLE IF NOT EXISTS`

### `backend/migrations/001_init.sql`
```sql
CREATE TABLE IF NOT EXISTS wiki_files (
  id SERIAL PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  content_hash TEXT NOT NULL,
  last_processed TIMESTAMPTZ,
  status TEXT DEFAULT 'ok'
);

CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  source_file TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recto_verso', 'cloze')),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  explanation TEXT,
  stability FLOAT DEFAULT 0,
  difficulty FLOAT DEFAULT 0.3,
  due_date TIMESTAMPTZ DEFAULT NOW(),
  last_review TIMESTAMPTZ,
  state TEXT DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  new_cards_per_day INTEGER DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO user_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS review_log (
  id SERIAL PRIMARY KEY,
  card_id INTEGER REFERENCES cards(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  stability_after FLOAT,
  difficulty_after FLOAT,
  due_after TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cards_due ON cards (due_date);
CREATE INDEX IF NOT EXISTS idx_cards_source ON cards (source_file);
CREATE INDEX IF NOT EXISTS idx_cards_state ON cards (state);
```

### `backend/server.js`
- Express avec `helmet` (sécurité headers) et `cors`
- Monte `/api/dashboard`, `/api/session`, `/api/settings`
- Sert `frontend/dist` (build Vite) pour toutes les routes non-API (`/*`)
- Port depuis `process.env.PORT` (défaut 3000)

### `backend/routes/dashboard.js` — `GET /api/dashboard`
Requête SQL :
1. Compte les cartes dues (`due_date <= NOW()`) + nouvelles cartes introduites aujourd'hui (selon limite `new_cards_per_day`)
2. Calcule `estimated_minutes` = `due_count * 15 / 60` (arrondi)
3. Compte les jours révisés cette semaine (`review_log` GROUP BY date)
4. Agrège par thème (premier segment du path `source_file` après `Memoire/_wiki/`)

### `backend/routes/session.js`

**`GET /api/session/cards?limit=N&theme=X`**
- Retourne les cartes dues triées par `due_date ASC`
- Si `theme` fourni : filtre sur `source_file LIKE '%/theme/%'`
- Si `limit=5` : renvoie les 5 plus urgentes
- Respecte la limite `new_cards_per_day` : sélectionne les cartes `state='new'` uniquement si le quota du jour n'est pas atteint (compte depuis `review_log` WHERE `date = TODAY`)

**`POST /api/session/cards/:id/rate`**
- Reçoit `{ rating: 1|2|3|4, reviewed_at }`
- Appelle `fsrs.js` pour calculer le nouvel intervalle
- Met à jour `cards` + insère dans `review_log`
- Retourne `{ next_due, stability, difficulty, state }`

### `backend/routes/summary.js` — `GET /api/session/summary?card_ids=1,2,3`
- Lit les entrées `review_log` des `card_ids` de la session en cours
- Calcule les compteurs again/hard/good/easy
- Calcule `mature_percent` = cartes avec `stability > 21` (3 semaines) / total cartes du thème dominant

### `backend/routes/settings.js`
- `GET /api/settings` → retourne `user_settings`
- `PUT /api/settings` → met à jour `new_cards_per_day`

### `backend/lib/fsrs.js`
- Wrapper autour du package `ts-fsrs`
- Exporte une fonction `rate(card, rating)` qui retourne `{ stability, difficulty, due_date, state }`
- `card` reçoit les champs FSRS depuis la DB ; `rating` est 1 (Again) / 2 (Hard) / 3 (Good) / 4 (Easy)

### `frontend/vite.config.js`
```js
import { VitePWA } from 'vite-plugin-pwa'
// manifest : name "FlashWiki", theme_color, icons
// workbox : cache statique + stratégie NetworkFirst pour /api/*
```

### `frontend/src/App.jsx`
- Routes : `/` → DashboardScreen, `/review` → ReviewScreen, `/summary` → SummaryScreen, `/settings` → SettingsScreen
- State global minimal : `sessionCards` (tableau des cartes chargées) + `ratings` (résultats en cours)

### `frontend/src/api/client.js`
- `baseURL` = `/api` (même origine que le backend)
- Fonctions : `getDashboard()`, `getSessionCards(limit, theme)`, `rateCard(id, rating)`, `getSummary(cardIds)`, `getSettings()`, `updateSettings(data)`
- Gestion erreur : throw avec message lisible

### `frontend/src/hooks/useOfflineQueue.js`
- Stocke les ratings en attente dans IndexedDB (`flash-wiki` store `pending-ratings`)
- À la reconnexion réseau (`online` event) : vide la queue en appelant `rateCard()` séquentiellement
- Utilisé dans ReviewScreen pour ne pas bloquer l'UX si le réseau est coupé

### `frontend/src/components/Card.jsx`
- Props : `front`, `back`, `explanation`, `type`, `onFlip`
- State : `flipped` (boolean)
- Rendu : deux faces CSS (`transform: rotateY`) — recto avec texte front, verso avec back + explanation
- Pour type `cloze` : remplace `___` au recto par un span souligné ; au verso, le mot de remplacement est en `<strong>`

### `frontend/src/screens/ReviewScreen.jsx`
- Charge les cartes via `getSessionCards()` au montage
- Affiche une carte à la fois (index courant dans state)
- Tap carte → flip Card
- Tap bouton rating → `rateCard()` (ou queue offline) → carte suivante
- Dernière carte → navigue vers `/summary`

### `frontend/src/screens/DashboardScreen.jsx`
- Charge `getDashboard()` au montage
- Affiche : estimation temps, WeekDots, bouton "Réviser" / "Juste 5 cartes", ThemeList
- Icône engrenage en haut à droite → `/settings`

---

## Ordre d'implémentation

### Étape 1 — Schéma DB
Fichier : `backend/migrations/001_init.sql`

**Cette étape est terminée quand** : on peut se connecter à un PostgreSQL local (`docker run postgres:16-alpine`), exécuter le SQL manuellement, et les 4 tables existent sans erreur.

---

### Étape 2 — Backend : connexion DB + migrations + server minimal
Fichiers : `backend/package.json`, `backend/db/client.js`, `backend/db/migrate.js`, `backend/server.js` (version minimale)

Dépendances à installer : `express pg cors helmet`

`server.js` à ce stade : Express basique + cors + helmet, aucune route encore, écoute sur `PORT`. Les routes seront ajoutées aux étapes 3 à 7 puis le fichier sera complété à l'étape 8.

**Cette étape est terminée quand** : `node db/migrate.js` s'exécute sans erreur et crée les tables ; re-exécuté une deuxième fois il est idempotent. `node server.js` démarre sans erreur sur le port configuré.

---

### Étape 3 — Backend : route settings
Fichier : `backend/routes/settings.js`, monté dans `backend/server.js`

**Cette étape est terminée quand** : `GET /api/settings` retourne `{ new_cards_per_day: 20 }` ; `PUT /api/settings` avec `{ new_cards_per_day: 10 }` met à jour la valeur et la requête GET suivante retourne `10`.

---

### Étape 4 — Backend : FSRS
Fichier : `backend/lib/fsrs.js`

Dépendance : `ts-fsrs`

**Cette étape est terminée quand** : un script de test `node lib/fsrs.test.js` applique les 4 ratings (1 à 4) à une carte `state: 'new'` et produit des `due_date` croissantes cohérentes (Again < Hard < Good < Easy).

---

### Étape 5 — Backend : route session (rate)
Fichiers : `backend/routes/session.js` (POST /api/cards/:id/rate uniquement)

**Cette étape est terminée quand** : en insérant manuellement une carte en DB (state='new'), `POST /api/cards/1/rate` avec `{ rating: 3 }` met à jour la carte et insère une ligne dans `review_log` avec les bonnes valeurs FSRS.

---

### Étape 6 — Backend : route dashboard
Fichier : `backend/routes/dashboard.js`

**Cette étape est terminée quand** : avec quelques cartes insérées en DB (dont certaines avec `due_date` passée), `GET /api/dashboard` retourne un objet avec `due_count` correct, `estimated_minutes`, `days_reviewed_this_week` (tableau de 7 booleans), et `themes` groupés par premier segment de `source_file`.

---

### Étape 7 — Backend : route session (cards) + summary
Fichiers : `backend/routes/session.js` (GET /api/session/cards), `backend/routes/summary.js`

**Cette étape est terminée quand** :
- `GET /api/session/cards` retourne les cartes dues triées par urgence, en respectant la limite `new_cards_per_day`
- `GET /api/session/summary?card_ids=1,2,3` retourne les compteurs corrects depuis `review_log`

---

### Étape 8 — Backend : server.js complété
Fichier : `backend/server.js`

Compléter `server.js` : monter toutes les routes (dashboard, session, settings, summary) et ajouter le service des fichiers statiques (`express.static` pointant vers `../frontend/dist`).

**Cette étape est terminée quand** : `node server.js` démarre sans erreur, toutes les routes répondent, et `GET /` retourne 404 (le build frontend n'existe pas encore — normal à ce stade).

---

### Étape 9 — Frontend : scaffolding + PWA
Fichiers : `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/api/client.js`

Dépendances : `react react-dom react-router-dom vite-plugin-pwa`

**Cette étape est terminée quand** : `npm run dev` lance le frontend sur `localhost:5173`, la route `/` affiche un texte placeholder sans erreur console, et Lighthouse PWA score ≥ 80.

---

### Étape 10 — Frontend : DashboardScreen
Fichiers : `frontend/src/screens/DashboardScreen.jsx`, `frontend/src/components/ThemeList.jsx`, `frontend/src/components/WeekDots.jsx`

**Cette étape est terminée quand** : en lançant backend + frontend en parallèle, l'écran `/` affiche les vraies données de l'API (estimation temps, thèmes, dots semaine), le bouton "Réviser" navigue vers `/review`, et l'icône engrenage vers `/settings`.

---

### Étape 11 — Frontend : ReviewScreen + Card
Fichiers : `frontend/src/screens/ReviewScreen.jsx`, `frontend/src/components/Card.jsx`

**Cette étape est terminée quand** : une session de 3 cartes (insérées manuellement en DB) se déroule de bout en bout — flip visible, 4 boutons répondent, chaque rating est envoyé à l'API et la carte suivante s'affiche, puis navigation automatique vers `/summary` après la dernière carte.

---

### Étape 12 — Frontend : SummaryScreen + SettingsScreen
Fichiers : `frontend/src/screens/SummaryScreen.jsx`, `frontend/src/screens/SettingsScreen.jsx`

**Cette étape est terminée quand** :
- La page `/summary` affiche le feedback de maîtrise et le bouton retour fonctionne
- La page `/settings` affiche le slider, le changement persiste après rechargement (API + localStorage)

---

### Étape 13 — Frontend : offline queue
Fichier : `frontend/src/hooks/useOfflineQueue.js`

**Cette étape est terminée quand** : en coupant le réseau (mode avion ou DevTools offline) pendant une session, les ratings sont mis en queue, et à la reconnexion ils sont envoyés automatiquement à l'API sans intervention manuelle.

---

### Étape 14 — Dockerfile + docker-compose.yml
Fichiers : `Dockerfile`, `docker-compose.yml`, `.env.example`

**Cette étape est terminée quand** : `docker compose up --build` depuis la racine démarre les 2 containers, `curl localhost:3000/api/dashboard` répond, et `curl localhost:3000` sert le HTML du frontend.

---

### Étape 15 — Déploiement Coolify
Actions sur le VPS :
1. Créer un nouveau projet Coolify `flash-wiki`
2. Créer un service PostgreSQL (postgres:16-alpine) avec `POSTGRES_DB=flashwiki`
3. Créer un service application (source : repo GitHub `flash_wiki/`, Dockerfile à la racine)
4. Configurer les variables d'env (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO`, `PORT=3000`)
5. Créer le domaine `flash.antoninbareau.eu` → A record vers `187.77.171.161`
6. Configurer le domaine dans Coolify (HTTPS via Let's Encrypt automatique)

**Cette étape est terminée quand** : `https://flash.antoninbareau.eu` est accessible depuis le smartphone Android, la PWA peut être installée sur l'écran d'accueil, et `GET /api/dashboard` retourne les données réelles.

---

### Étape 16 — Workflow n8n
Configuration dans l'interface n8n (pas de fichier code) :

**Structure du workflow** :
1. **Cron** : tous les lundis à 03h00
2. **HTTP Request** → `GET https://api.github.com/repos/{{GITHUB_REPO}}/git/trees/main?recursive=1` (liste tous les fichiers)
3. **Code** : filtrer les fichiers dans `Memoire/_wiki/` avec extension `.md`
4. **PostgreSQL** : `SELECT path, content_hash FROM wiki_files`
5. **Code** : pour chaque fichier, récupérer le contenu via GitHub API, calculer MD5, comparer avec DB
6. **Split In Batches** : traiter les fichiers modifiés/nouveaux 1 par 1 (évite rate limit Claude)
7. **Si modifié** → **PostgreSQL** DELETE cartes existantes pour ce path
8. **HTTP Request** → API Claude (claude-haiku-4-5, le moins cher) avec prompt structuré
9. **Code** : parser la réponse JSON de Claude, construire les INSERT
10. **PostgreSQL** : insérer les nouvelles cartes
11. **PostgreSQL** : `UPSERT wiki_files SET content_hash=..., last_processed=NOW()`

**Prompt Claude (étape 8)** :
```
Tu es un générateur de flashcards pédagogiques. À partir de la fiche Markdown suivante, génère des flashcards pour mémoriser les concepts clés.

Retourne uniquement un JSON valide (sans markdown, sans commentaire) :
{
  "cards": [
    {"type": "recto_verso", "front": "question précise", "back": "réponse concise", "explanation": "1-2 phrases de contexte"},
    {"type": "cloze", "front": "phrase avec ___ pour le concept clé", "back": "phrase complète avec le concept en gras **concept**", "explanation": "1-2 phrases de contexte"}
  ]
}

Génère entre 2 et 5 cartes par fiche (selon la richesse du contenu). Équilibre recto/verso et cloze.

Fiche :
{{wikiContent}}
```

**Cette étape est terminée quand** : exécution manuelle du workflow depuis n8n traite une fiche wiki test et insère les cartes en DB ; la semaine suivante, le cron tourne automatiquement.

---

## Tests de vérification finale

### Golden path
1. Modifier une fiche wiki dans Obsidian → commit + push GitHub
2. Déclencher le workflow n8n manuellement
3. Vérifier en DB que les nouvelles cartes ont été insérées et les anciennes supprimées
4. Ouvrir `flash.antoninbareau.eu` sur le smartphone Android
5. Le dashboard affiche les nouvelles cartes (estimation de temps + thème wiki)
6. Lancer "Réviser" → faire une session complète (flip + 4 ratings)
7. Vérifier que l'écran de résumé affiche le feedback de maîtrise
8. Retourner au dashboard → estimation de temps réduite (cartes révisées)
9. Rouvrir l'app le lendemain → seules les cartes dues sont proposées (FSRS)

### Cas limites identifiés en phase 2
- [ ] Fiche wiki < 100 mots → skip dans n8n, aucune carte générée, aucune erreur
- [ ] Fiche wiki supprimée → cartes conservées en DB, dashboard normal
- [ ] 300 cartes générées d'un coup → dashboard affiche seulement `new_cards_per_day` (défaut 20) le premier jour
- [ ] Réseau coupé pendant session → ratings mis en queue IndexedDB, synchronisés à la reconnexion
- [ ] Carte avec front > 300 caractères → texte scrollable, pas de troncature
- [ ] 100% Again → message neutre affiché en fin de session
- [ ] Modifier `new_cards_per_day` à 5 → s'applique dès le lendemain, pas rétroactif
- [ ] Session "Juste 5 cartes" → exactement 5 cartes, écran de résumé correct après
- [ ] Carte cloze avec 2 trous → les deux `___` affichés simultanément au recto, les deux mots en gras au verso
- [ ] Session interrompue (app envoyée en arrière-plan puis rouverte) → reprend à la carte en cours sans perte
- [ ] DB inaccessible (backend down) → dashboard affiche le message d'erreur "Impossible de charger les cartes · vérifie ta connexion"
