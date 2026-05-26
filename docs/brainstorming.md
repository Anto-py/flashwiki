# flash_wiki — brainstorming.md

---

## Fonctionnalité 1 : Pipeline n8n — génération des flashcards

### UI
Aucune UI directe. Le pipeline tourne en tâche de fond sur le VPS, déclenché par un cron n8n chaque lundi matin (ex. 03h00).

### Interactions
1. n8n pull le repo GitHub du vault via l'API GitHub (liste des commits depuis le dernier run)
2. Pour chaque fichier `.md` modifié ou nouveau dans `Memoire/_wiki/` :
   - Calcul du hash MD5 du contenu du fichier
   - Comparaison avec le hash stocké en DB (`wiki_files.content_hash`)
   - **Nouveau fichier** → générer les cartes, insérer en DB
   - **Fichier modifié** (hash différent) → supprimer toutes les cartes associées (`cards.source_file`), puis régénérer
   - **Fichier supprimé** → ne rien faire (cartes conservées)
3. Appel à l'API Claude avec le contenu Markdown de la fiche → prompt structuré demandant N cartes recto/verso + M cartes cloze
4. Insertion des cartes en DB avec état FSRS initial (`new`)
5. Mise à jour de `wiki_files.content_hash` et `wiki_files.last_processed`

### États
- **Run normal** : log n8n vert, cartes insérées
- **Aucune modification** : run silencieux, aucune carte créée
- **Erreur API Claude** : log d'erreur n8n, fichier marqué `error` → retry au prochain run
- **Fichier wiki trop court** (<100 mots) : skip, log d'avertissement

### Cas limites
- Fiche wiki supprimée du repo → cartes conservées en DB, `source_file` devient une référence orpheline (acceptable)
- Fiche wiki avec seulement du frontmatter YAML et pas de contenu → skip
- Rate limit API Claude → n8n gère le retry avec backoff exponentiel
- VPS redémarré en milieu de run → n8n reprend au prochain cron (idempotent par hash)

### Exemples JSON

**Table `wiki_files`**
```json
{
  "id": 12,
  "path": "Memoire/_wiki/Pedagogie/hook_model.md",
  "content_hash": "a3f8b2c1d4e5f6a7",
  "last_processed": "2026-05-26T03:12:44Z",
  "status": "ok"
}
```

**Table `cards`**
```json
{
  "id": 147,
  "source_file": "Memoire/_wiki/Pedagogie/hook_model.md",
  "type": "recto_verso",
  "front": "Quelles sont les 4 phases du Hook Model d'Eyal ?",
  "back": "Trigger → Action → Variable Reward → Investment",
  "explanation": "Chaque phase renforce la suivante : l'Investment améliore la précision du prochain Trigger, créant une boucle auto-renforcée.",
  "stability": 0,
  "difficulty": 0.3,
  "due_date": "2026-05-26T00:00:00Z",
  "last_review": null,
  "state": "new",
  "reps": 0,
  "lapses": 0,
  "created_at": "2026-05-26T03:12:51Z"
}
```

```json
{
  "id": 148,
  "source_file": "Memoire/_wiki/Pedagogie/hook_model.md",
  "type": "cloze",
  "front": "Dans le Hook Model, le pic de dopamine se produit à l'___ d'une récompense, pas à la récompense elle-même.",
  "back": "Dans le Hook Model, le pic de dopamine se produit à l'**anticipation** d'une récompense, pas à la récompense elle-même.",
  "explanation": "Découvert par Wolfram Schultz (1997) : c'est l'incertitude de la récompense variable qui génère l'engagement, pas la récompense certaine.",
  "stability": 0,
  "difficulty": 0.3,
  "due_date": "2026-05-26T00:00:00Z",
  "last_review": null,
  "state": "new",
  "reps": 0,
  "lapses": 0,
  "created_at": "2026-05-26T03:12:52Z"
}
```

---

## Fonctionnalité 2 : Écran d'accueil (dashboard)

### UI
Deux zones verticales :

**Zone haute — résumé global**
- Estimation de temps : "≈ 12 min" (calculé à 15 sec/carte en moyenne)
- Nombre total de cartes en DB (secondaire, petite police)
- Jours révisés cette semaine (7 points, ceux du jour cochés) — indicateur visuel sans être un streak punitif
- Bouton principal : **"Réviser"** (plein écran, couleur primaire)
- Bouton secondaire : **"Juste 5 cartes"** (contour, sous le bouton principal)

**Zone basse — par thème**
- Liste des dossiers wiki ayant des cartes dues
- Pour chaque thème : nom du dossier + nombre de cartes dues + barre de progression (% cartes matures)
- Tap sur un thème → session filtrée sur ce thème

### Interactions
- Tap "Réviser" → session avec toutes les cartes dues (triées par urgence FSRS)
- Tap "Juste 5 cartes" → session avec les 5 cartes les plus urgentes selon `due_date`
- Tap sur un thème → session filtrée
- Si aucune carte due : les boutons "Réviser" et "Juste 5 cartes" restent visibles mais lancent une session anticipée (cartes pas encore dues, les plus proches de leur `due_date`)

### États
- **Cartes dues** : interface normale, boutons actifs, estimation de temps affichée
- **Aucune carte due** : message "Tout est à jour · prochaine révision dans X h" + boutons toujours accessibles pour session anticipée
- **DB inaccessible** : message d'erreur "Impossible de charger les cartes · vérifie ta connexion"
- **Chargement** : skeleton loader sur les zones de données (pas de spinner global)

### Cas limites
- 0 carte en DB (app toute neuve, pipeline pas encore tourné) → message d'accueil "Les cartes arrivent dimanche · le pipeline tourne chaque lundi"
- Connexion lente : affichage du cache local si disponible (Service Worker), sinon message d'erreur
- Thème avec 1 seule carte due → affiché normalement

### Exemples JSON

**Réponse API `/api/dashboard`**
```json
{
  "due_count": 23,
  "estimated_minutes": 6,
  "total_cards": 187,
  "days_reviewed_this_week": [true, true, false, true, false, false, false],
  "themes": [
    {
      "name": "Pedagogie",
      "due_count": 14,
      "mature_percent": 42
    },
    {
      "name": "harnais_IA",
      "due_count": 9,
      "mature_percent": 71
    }
  ]
}
```

---

## Fonctionnalité 3 : Session de révision — carte recto/verso

### UI
Plein écran, une carte à la fois.

**Recto** : question centrée verticalement, police lisible (min 18px), indicateur de progression en haut "3 / 23"

**Verso** (après flip) :
- Réponse en haut (texte principal)
- Explication en dessous (texte secondaire, plus petit, couleur atténuée)
- 4 boutons en bas, pleine largeur : **Again** · **Hard** · **Good** · **Easy**

### Interactions
- Tap sur la carte (n'importe où) → animation de flip (CSS 3D), révèle le verso
- Tap sur un des 4 boutons → enregistrement du rating, calcul FSRS, chargement de la carte suivante
- Swipe horizontal → non supporté (évite les erreurs de manipulation)

### États
- **Chargement carte suivante** : transition douce (fade), pas de spinner
- **Dernière carte de la session** → après rating, transition vers l'écran de fin
- **Erreur d'enregistrement du rating** (réseau coupé) → retry silencieux en background, carte comptée quand même

### Cas limites
- Carte avec `front` très long (>300 caractères) → texte scrollable dans la zone carte, pas de troncature
- Réseau coupé pendant la session → les ratings sont mis en queue locale (IndexedDB), synchronisés à la reconnexion
- Session interrompue (app mise en arrière-plan) → à la réouverture, reprend à la carte en cours

### Exemples JSON

**Réponse API `/api/session/next`**
```json
{
  "card_id": 147,
  "type": "recto_verso",
  "front": "Quelles sont les 4 phases du Hook Model d'Eyal ?",
  "back": "Trigger → Action → Variable Reward → Investment",
  "explanation": "Chaque phase renforce la suivante : l'Investment améliore la précision du prochain Trigger, créant une boucle auto-renforcée.",
  "position": 3,
  "total": 23
}
```

**POST `/api/session/rate`**
```json
{
  "card_id": 147,
  "rating": 3,
  "reviewed_at": "2026-05-26T08:14:32Z"
}
```

**Réponse**
```json
{
  "next_due": "2026-05-30T00:00:00Z",
  "stability": 4.2,
  "difficulty": 0.28,
  "state": "review"
}
```

---

## Fonctionnalité 4 : Session de révision — carte cloze

### UI
Identique au recto/verso, avec une différence au recto :

**Recto** : phrase complète avec le mot/groupe manquant remplacé par `___`
Exemple : *"Dans le Hook Model, le pic de dopamine se produit à l'___ d'une récompense."*

**Verso** : phrase complète avec le mot manquant mis en **gras** ou surligné + explication

### Interactions
- Identique au recto/verso : tap pour retourner, 4 boutons d'évaluation

### États
- Identiques au recto/verso

### Cas limites
- Carte cloze avec plusieurs trous → tous les trous affichés avec `___` simultanément (pas de révélation progressive)
- Trou en début de phrase → majuscule conservée : `"___ est le fondateur du Fogg Behavior Model."`

### Exemples JSON

```json
{
  "card_id": 148,
  "type": "cloze",
  "front": "Dans le Hook Model, le pic de dopamine se produit à l'___ d'une récompense, pas à la récompense elle-même.",
  "back": "Dans le Hook Model, le pic de dopamine se produit à l'**anticipation** d'une récompense, pas à la récompense elle-même.",
  "explanation": "Découvert par Wolfram Schultz (1997) : l'incertitude de la récompense variable génère l'engagement, pas la récompense certaine.",
  "position": 4,
  "total": 23
}
```

---

## Fonctionnalité 5 : Écran de fin de session

### UI
- Message principal : feedback de maîtrise, ancré dans l'apprentissage réel
  → *"Tu retiens 67% de tes notions Pédagogie"*
- Détail session : X cartes vues · Y Again · Z Good/Easy
- Bouton : **"Retour à l'accueil"**

### Interactions
- Tap "Retour à l'accueil" → retour dashboard

### États
- **Session complète** (toutes les cartes dues révisées) : message positif + stats
- **Session 5 cartes** : même écran, stats sur 5 cartes
- **Session interrompue** (bouton retour OS) → stats partielles à la réouverture, pas de perte

### Cas limites
- 100% Again (tout raté) → message neutre, pas culpabilisant : *"C'est normal au début · ces cartes repasseront bientôt"*
- Session de 1 seule carte → stats affichées normalement

### Exemples JSON

**Réponse API `/api/session/summary`**
```json
{
  "cards_reviewed": 23,
  "again_count": 3,
  "hard_count": 4,
  "good_count": 12,
  "easy_count": 4,
  "mastery": {
    "theme": "Pedagogie",
    "mature_percent": 67
  }
}
```

---

## Fonctionnalité 6 : Paramètres utilisateur

### UI
Écran accessible depuis l'accueil (icône engrenage en haut à droite). Simple liste de réglages :
- **Nouvelles cartes par jour** : slider ou champ numérique (défaut : 20, min : 5, max : 50)
- Label explicatif : "Au démarrage, toutes les nouvelles cartes attendent ici. Ce nombre contrôle le rythme d'introduction."

### Interactions
- Modification du slider → sauvegarde immédiate en `localStorage` + mise à jour en DB (`user_settings`)
- Retour à l'accueil recalcule le nombre de cartes dues en tenant compte de la limite

### États
- **Premier démarrage** : valeur par défaut 20 affichée, explication courte visible
- **Pipeline vient de tourner** (ex. 300 nouvelles cartes) : l'app n'en présente que 20 le premier jour — les autres restent en état `new` et s'écoulent au fil des jours

### Cas limites
- Si l'utilisateur baisse la limite à 5 alors qu'il avait déjà vu 20 cartes/jour → pas d'effet rétroactif, s'applique dès le lendemain
- Si toutes les nouvelles cartes ont été introduites → paramètre sans effet, seules les révisions dues s'affichent

### Exemples JSON

**Table `user_settings`**
```json
{
  "id": 1,
  "new_cards_per_day": 20,
  "updated_at": "2026-05-26T09:00:00Z"
}
```

**Réponse API `/api/dashboard` avec limite appliquée**
```json
{
  "due_count": 23,
  "new_today": 8,
  "new_remaining_today": 12,
  "estimated_minutes": 6,
  "total_cards": 187,
  "days_reviewed_this_week": [true, true, false, true, false, false, false],
  "themes": [
    {
      "name": "Pedagogie",
      "due_count": 14,
      "mature_percent": 42
    }
  ]
}
```

---

## Fonctionnalité 7 : Leviers d'engagement

### Récapitulatif des leviers implémentés

| Levier | Où | Mécanisme |
|---|---|---|
| Estimation de temps | Dashboard | "≈ 12 min" au lieu de "23 cartes" |
| Feedback de maîtrise | Fin de session | "Tu retiens 67% de tes notions Pédagogie" |
| Progression par thème | Dashboard | % cartes matures par dossier wiki |
| Session Tiny Habit | Dashboard | Bouton "Juste 5 cartes" |
| Indicateur hebdo | Dashboard | 7 points (jours révisés) — sans punition si manqué |

### Leviers explicitement exclus
- Streak punitif (abandon si brisé — cf. fiche `leviers_engagement_flashcard.md`)
- Notifications push (trop intrusives)
- XP / points / badges (découplés de l'apprentissage réel)
