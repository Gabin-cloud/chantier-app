# Chantier App

Application de contrôle de chantier : interface PC, tablette, portail entreprise, complément Outlook.

## Démarrage rapide

```bash
npm install
cp .env.example .env.local   # puis remplir les clés Supabase
npm run dev
```

Ouvrir http://localhost:3000 — choix PC / Tablette / Entreprise.

## Documentation

| Fichier | Contenu |
|---------|---------|
| [docs/PROJET.md](docs/PROJET.md) | Carte complète : interfaces, domaines, structure code |
| [docs/DATABASE.md](docs/DATABASE.md) | Connexion Supabase, MCP Cursor, migrations |
| [supabase/migrations/README.md](supabase/migrations/README.md) | Ordre des migrations SQL |

## Commandes utiles

```bash
npm run dev              # Serveur Next.js
npm run db:push          # Appliquer migrations Supabase
npm run db:status        # État des migrations
npm run desktop:dev      # App Electron + Next.js
npm run outlook:manifest # URL manifest complément Outlook
```

## GitHub

Dépôt : https://github.com/Gabin-cloud/chantier-app

**Workflow :** code + migration → `npm run db:push` → commit → push.

Ne pas copier-coller du SQL manuellement dans Supabase (voir `docs/DATABASE.md`).

## Stack

- Next.js 16, React 19, TypeScript, Tailwind
- Supabase (PostgreSQL, auth, storage)
- Microsoft Graph (Outlook, SharePoint)
- Electron (client bureau Windows optionnel)
