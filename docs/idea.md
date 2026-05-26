# flash_wiki — idea.md

## Contexte

Application personnelle de flashcards avec répétition espacée (algorithme FSRS), alimentée automatiquement par les fiches du wiki Obsidian (`Memoire/_wiki/`). Utilisée principalement sur smartphone. Hébergée sur le VPS Hostinger KVM1 d'Antonin, aux côtés des projets Docker existants (n8n, Abbadaba).

---

## Périmètre

### In scope
- **Pipeline de génération hebdomadaire** (via n8n) : pull du repo GitHub du vault → lecture des fiches wiki nouvelles ou modifiées → génération de flashcards via l'API Claude → insertion en base de données PostgreSQL
- **Tracking des fiches traitées** : mécanisme léger (hash de contenu ou date de commit Git) pour ne retraiter que les fiches nouvelles ou modifiées — minimiser les appels IA
- **Deux formats de carte** générés par l'IA :
  - Recto/verso classique (question → réponse + explication)
  - Cloze (texte à trou → complétion + explication)
- **App PWA mobile** pour réviser les cartes : interface simple, installable sur l'écran d'accueil, connectée à la base PostgreSQL sur le VPS
- **Algorithme FSRS** pour planifier les révisions (intervalles, facteur de difficulté, date de prochaine révision)

### Out of scope
- Création manuelle de flashcards par l'utilisateur
- Partage de cartes ou usage multi-utilisateur
- App native (iOS/Android store)
- Synchronisation hors-ligne (les cartes nécessitent une connexion)
- Interface d'administration avancée des cartes

---

## Public cible et contexte d'usage

Utilisateur unique : Antonin. Usage personnel, essentiellement sur smartphone, pour mémoriser les notions consolidées dans son wiki. Sessions courtes en mobilité (transport, pauses).

---

## Stack technique

| Composant | Technologie |
|---|---|
| Hébergement | VPS Hostinger KVM1 |
| Conteneurisation | Docker (existant) |
| Orchestration automatisation | n8n (existant) |
| Base de données | PostgreSQL (nouveau conteneur Docker) |
| Backend API | Node.js / Express (nouveau conteneur Docker) |
| Frontend | PWA — React + Vite (ou Vanilla JS selon complexité) |
| Génération IA | API Claude (Anthropic) |
| Source wiki | Dépôt GitHub du vault Obsidian |
| Algorithme SRS | FSRS (implémentation JS open source) |

---

## Contraintes

- **Économie de tokens IA** : seules les fiches nouvelles ou modifiées depuis le dernier passage sont envoyées à Claude — le tracking doit être aussi simple que possible
- **Mobile-first** : l'interface de révision doit être pensée pour les écrans ~390px, gestes tactiles
- **Projet Docker isolé** : créer un nouveau projet Docker sur le VPS (PostgreSQL + backend + frontend), sans toucher aux conteneurs existants
- **Pas de budget précis** mais sobriété souhaitée (VPS KVM1 = ressources limitées)

---

## Critères de succès

L'application est considérée utilisable quand :
1. Le pipeline n8n tourne chaque semaine, lit les fiches wiki depuis GitHub, et génère des cartes (recto/verso + cloze) pour les fiches nouvelles/modifiées uniquement
2. Les cartes sont stockées en PostgreSQL sur le VPS
3. L'app PWA est accessible depuis le smartphone, affiche les cartes à réviser selon FSRS, et enregistre les résultats de révision
4. Le cycle complet (wiki modifié → nouvelle carte → révision sur smartphone) fonctionne de bout en bout
