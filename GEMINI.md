# Contexte local — flash_wiki

*(Généré depuis CLAUDE.md — contexte global dans /GEMINI.md)*

# flash_wiki

PWA de flashcards avec répétition espacée (FSRS), alimentée automatiquement depuis le wiki Obsidian via un pipeline n8n hebdomadaire.

## Stack

| Composant | Technologie |
|---|---|
| Backend | Node.js / Express + `pg` (SQL brut, pas d'ORM) |
| Frontend | React + Vite — PWA via `vite-plugin-pwa` |
| Base de données | PostgreSQL 16 Alpine (Docker) |
| Algorithme SRS | `ts-fsrs` |
| Pipeline | n8n (cron lundi 03h00) → GitHub API → Claude API (Haiku) |
| Déploiement | Coolify — `flash.antoninbareau.eu` |

## Architecture clé

- **2 containers** : `flash-wiki-app` (Express sert API + build React statique) + `flash-wiki-db`
- **Dockerfile multi-stage** : build frontend → copie dans image backend (pas de container nginx séparé)
- **Migrations SQL** au démarrage (`db/migrate.js` → `migrations/*.sql`) — idempotentes
- **Tracking wiki** : hash MD5 par fiche — nouveau/modifié → régénère les cartes ; supprimé → cartes conservées

## Statut

| Phase | Statut |
|---|---|
| Conception (`docs/`) | Terminé |
| Implémentation | À créer |

## Instructions pour Claude

- Lire `docs/plan.md` avant toute implémentation — l'arborescence et l'ordre des étapes y sont définis
- Sobriété : ne pas reproduire la lourdeur d'Abbadaba (pas de Next.js, pas de Prisma)
- Tester en local (`docker compose up`) avant tout déploiement Coolify
- Pas d'accents dans les noms de fichiers/dossiers
