# Chantier App — Carte du projet

Application de **contrôle de chantier** pour conducteurs de travaux : visites sur plan, finances, tri des mails, portail entreprises.

**Dépôt GitHub :** https://github.com/Gabin-cloud/chantier-app

---

## Les 3 interfaces + Outlook

| Interface | URL | Public | Rôle |
|-----------|-----|--------|------|
| **PC** | `/pc` | Comptes **DANOBAT** | Bureau : explorateur par maître d'ouvrage, favoris, contrôles, finances |
| **Tablette** | `/tablette` | Comptes **DANOBAT** | Chantier : visites, plans, checklist sécurité (+ favoris partagés) |
| **Entreprise** | `/entreprise` | Comptes **entreprise** (invités) | Portail sous-traitants uniquement — pas d'accès PC/tablette |
| **Outlook** | `/outlook/taskpane` | Complément Office | Tri rapide des pièces jointes du mail ouvert |

Après connexion, le middleware route selon `profiles.account_kind` :
`danobat` → `/pc` ou `/tablette` (selon appareil) ; `entreprise` → `/entreprise`.
La page `/` pour les non connectés propose la connexion (plus de choix d'interface libre pour les comptes entreprise).

---

## Domaines fonctionnels (ne pas perdre)

### 1. Emails & Microsoft 365

- Connexion Microsoft 365 (Profil) → OAuth Azure
- **Modèles de mails** (`/pc/parametres`) — étiquettes dynamiques, CC, signature
- **Brouillons Outlook** après visite de contrôle — prévisualisation, envoi
- **Notifications** à la création de projet / fin de visite
- Fichiers : `src/lib/microsoft/`, `src/lib/email/`, `src/lib/actions/email-templates.ts`, `control-board.ts`

### 2. Réception & tri des fichiers (mails)

- **Boîte de tri** — `/pc/projets/[id]/finance/tri`
- Catégories : facture, devis, administratif, chantier, plan d’exé, autre
- Classement vers SharePoint ou stockage Supabase
- **Tri rapide** : FAB sur PC + volet **Outlook** (`OutlookFileSortPane`)
- Fichiers : `incoming-files.ts`, `FileSortForm`, `QuickFileSortPopup`, `OutlookFileSortPane`

### 3. Chantier (tablette)

- Projets, phases, emplacements, plans PDF
- **Visites** : marqueurs, réserves, annotations sur plan, checklist, photos
- **Rapport PDF** de visite + envoi mail
- Fichiers : `src/app/tablette/`, `src/components/visits/`, `visits.ts`, `checklist.ts`, `plans.ts`

### 4. Contrôles (PC)

- Bibliothèque de points de contrôle, zones, phases
- Tableau de bord des non-conformités (`control_point_tracking`)
- Rapports de visite PC + brouillons email
- Fichiers : `src/app/pc/projets/[id]/controles/`, `control-board.ts`, `zones.ts`

### 5. Finance (PC)

- Lots / entreprises, avenants, situations, délégations
- Récap marchés, récap situations, garanties bancaires
- Upload factures entreprises
- Fichiers : `src/app/pc/projets/[id]/finance/`, `finance.ts`

### 6. Portail entreprise

- Accès par invitation (`enterprise-access.ts`)
- Sous-traitance, choix travaux, dépôt documents
- Fichiers : `src/app/entreprise/`, `sous-traitance.ts`

### 7. SharePoint

- Chemins plan d’exé par projet / dossier entreprise
- Upload tri → bibliothèque SharePoint
- Fichiers : `sharepoint-settings.ts`, `src/lib/microsoft/sharepoint.ts`

---

## Structure du code (reprise partielle)

```
src/
├── app/
│   ├── pc/              ← Interface bureau
│   ├── tablette/        ← Interface terrain
│   ├── entreprise/      ← Portail sous-traitants
│   ├── outlook/         ← Complément Outlook
│   ├── api/             ← OAuth, manifest Outlook, PDF plans
│   └── login/
├── components/          ← UI par domaine (finance, visits, outlook…)
├── lib/
│   ├── actions/         ← Server Actions (logique métier)
│   ├── types/           ← Types TypeScript (database.ts)
│   ├── supabase/        ← Client Supabase
│   ├── microsoft/       ← Graph API, OAuth, SharePoint
│   ├── email/           ← Destinataires, HTML
│   ├── notifications/   ← Mails automatiques
│   └── outlook/         ← Manifest add-in
supabase/
└── migrations/          ← Schéma SQL (source de vérité)
electron/                ← App bureau Windows (optionnel)
```

### Ordre de reprise recommandé

1. **Base** — auth, projets, membres (`001`–`005`)
2. **Plans & visites** — tablette (`002`, `007`–`011`)
3. **Finance** — lots, situations (`003`, `004`)
4. **Emails M365** — (`006`, `014`–`018`)
5. **Tri fichiers + SharePoint** — (`013`, `017`)
6. **Contrôles** — (`012`, `013`)
7. **Entreprise / sous-traitance** — (`019`–`022`)

---

## Server Actions (référence rapide)

| Fichier | Domaine |
|---------|---------|
| `projects.ts` | Projets, entreprises (lots) |
| `members.ts` | Membres & rôles projet |
| `finance.ts` | Situations, avenants, garanties |
| `incoming-files.ts` | Tri des fichiers reçus |
| `visits.ts` | Visites, marqueurs, photos |
| `checklist.ts` | Checklist + annotations plan |
| `visit-reports.ts` | PDF rapport de visite |
| `control-board.ts` | Tableau contrôle + mails |
| `email-templates.ts` | Modèles de mails |
| `enterprise-access.ts` | Invitations entreprises |
| `sous-traitance.ts` | Demandes sous-traitance |
| `sharepoint-settings.ts` | Config SharePoint |
| `auth.ts` / `profile.ts` | Connexion & profil |

---

## Variables d’environnement

Voir `.env.example` à la racine. **Ne jamais committer `.env`.**

---

## Workflow GitHub + base de données

1. Modifier le code ou ajouter une migration dans `supabase/migrations/`
2. Tester en local : `npm run dev`
3. Appliquer la base : `npm run db:push` (voir `docs/DATABASE.md`)
4. Commit + push GitHub

**Règle d’or :** ne plus copier-coller du SQL à la main dans Supabase. Toute modification de schéma passe par un fichier de migration versionné.

---

## Desktop & Outlook

```bash
npm run desktop:dev          # App Electron + Next.js
npm run outlook:manifest     # URL du manifest pour installer le complément
```

Manifest Outlook : `{NEXT_PUBLIC_APP_URL}/api/outlook/manifest`
