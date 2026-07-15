# Migrations Supabase

Ordre d’application (numéros uniques, tri alphabétique) :

| # | Fichier | Contenu |
|---|---------|---------|
| 001 | `001_phase1_projects.sql` | Projets, entreprises, membres |
| 002 | `002_phase2_plans_visits.sql` | Plans, visites |
| 003 | `003_phase7_financial.sql` | Finance de base |
| 004 | `004_phase7_financial_improvements.sql` | Améliorations finance |
| 005 | `005_auth_access.sql` | Auth, rôles, RLS |
| 006 | `006_email_m365.sql` | Tokens Microsoft 365 |
| 007 | `007_sprint2_reserves_drawings.sql` | Réserves, annotations |
| 008 | `008_sprint3_phases_plan_folders.sql` | Phases, dossiers plans |
| 009 | `009_drawings_by_phase.sql` | Dessins par phase |
| 010 | `010_control_points_on_markers.sql` | Points de contrôle |
| 011 | `011_zones_library_visit_reports.sql` | Zones, bibliothèque, rapports |
| 012 | `012_control_board_tracking.sql` | Suivi tableau de contrôle |
| 013 | `013_incoming_files.sql` | Boîte de tri fichiers |
| 014 | `014_reports_email_rls.sql` | RLS rapports & contrôle |
| 015 | `015_email_draft_status.sql` | Statut brouillon email |
| 016 | `016_email_templates.sql` | Modèles de mails |
| 017 | `017_sharepoint_plan_exe.sql` | SharePoint & plan d’exé |
| 018 | `018_profile_email_signature.sql` | Signature email profil |
| 019 | `019_email_template_cc.sql` | CC modèles |
| 020 | `020_email_templates_permissions.sql` | Permissions modèles |
| 021 | `021_sous_traitance_entreprise_access.sql` | Accès entreprise |
| 022 | `022_sous_traitance_schema_rls.sql` | Schéma sous-traitance |
| 023 | `023_perf_security_hardening.sql` | Index FK, search_path, RLS initplan, revoke anon |
| 024 | `024_fix_rls_gaps.sql` | Policies manquantes (control_library_items, phase_zones) |
| 025 | `025_lock_security_definer_execute.sql` | REVOKE PUBLIC + GRANT authenticated sur fonctions SECURITY DEFINER |
| 026 | `026_operation_sheet.sql` | Fiche opération : champs MOA/MOE projet, champs entreprise détaillés, base `company_directory` |
| 027 | `027_owner_directory.sql` | Annuaire maîtres d'ouvrage réutilisable (`owner_directory`) |

## Audit base distante (2026-07)

La base distante n'avait **aucun historique de migration** (`supabase_migrations.schema_migrations` vide) : le schéma avait été créé par copier-coller manuel. Constats principaux :

- Tables avec RLS activé mais **sans policy** (activation manuelle) : `control_library_items`, `phase_zones` → corrigé en `024`.
- 13 clés étrangères **sans index** → corrigé en `023`.
- Policies RLS ré-évaluant `auth.uid()` par ligne → optimisé en `023`.
- Fonctions `SECURITY DEFINER` exécutables par `anon` via RPC → révoqué en `023`.
- Policies `Allow all` (`USING true`) sur `visit_phases`, `plan_folders`, `phase_checklist_items`, `visit_checklist_responses` : **laissées telles quelles** (conformes aux migrations Git ; durcissement possible dans une future migration à valider).
- À activer côté dashboard : *Leaked password protection* (Auth).

## Historique de renommage (2026-07)

Les fichiers suivants ont été renumérotés pour supprimer les doublons `012` et `015` :

- `012_incoming_files` → `013_incoming_files`
- `013_reports_email_rls` → `014_reports_email_rls`
- … (décalage +1 jusqu’à `020`)
- `015_sharepoint_plan_exe` → `017_sharepoint_plan_exe`
- `019_sous_traitance_entreprise_access` → `021_…`
- `020_sous_traitance_schema_rls` → `022_…`

Si votre base distante a déjà les **anciens noms** dans `schema_migrations`, voir `docs/DATABASE.md` § Réparer.
