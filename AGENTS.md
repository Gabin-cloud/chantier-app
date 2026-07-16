<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:form-field-rules -->
# Champs de formulaire

Utiliser `AppField` / `AppFormField` (`src/components/ui/`) pour tout champ éditable : validation bloquante, unités, séparateurs milliers, violet si non enregistré. Voir `.cursor/rules/form-fields.mdc`.
<!-- END:form-field-rules -->

## Cursor Cloud specific instructions

Next.js 16 + Supabase app (interfaces `/pc`, `/tablette`, `/entreprise`, `/outlook`). Standard commands live in `README.md` / `package.json` (`npm run dev`, `npm run build`, `npm run lint`). The update script runs `npm install`; everything below is service startup that is NOT in the update script.

### Running locally end-to-end (requires a Supabase backend)
The app needs Supabase (auth + Postgres). There is no cloud project wired up, so run the **local Supabase stack** via Docker:

1. Start the Docker daemon (it is installed but not auto-started): `sudo dockerd &` then `sudo chmod 666 /var/run/docker.sock` so `docker`/`supabase` work without sudo.
2. `npx supabase start` — pulls images (first time only), applies all `supabase/migrations/`, and runs `supabase/seed.sql`. It prints `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` (these are the deterministic local demo keys, identical every run).
3. Create `.env.local` (gitignored) with those local values:
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>`
   - `SUPABASE_SERVICE_ROLE_KEY=<local service_role key>`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
4. `npm run dev` → http://localhost:3000.

### Non-obvious gotchas
- **`supabase/seed.sql` is required, not optional.** Local migrations run as the `postgres` role, whose default privileges only grant `TRUNCATE/REFERENCES/TRIGGER` to `anon/authenticated/service_role`. Without the seed's `GRANT SELECT/INSERT/UPDATE/DELETE`, every logged-in query fails with `permission denied for table ...`. Supabase Cloud grants these automatically; the seed only replicates that locally. It re-runs on `supabase db reset`; after a manual reset re-apply it if needed: `docker exec -i -e PGPASSWORD=postgres supabase_db_chantier-app psql -U postgres -d postgres < supabase/seed.sql`.
- **First signup becomes `super_admin`** (`handle_new_user` trigger); later signups are regular `user`. Only super_admins / project members can create/see projects (RLS via `user_can_access_project`). Because `createProject` does `insert().select()` (RETURNING triggers the SELECT policy on a project with no members yet), a plain `user` cannot create a project — test project creation with the super_admin account.
- **Microsoft 365 / Outlook / SharePoint** integrations are optional and feature-gated by `AZURE_*` / `SHAREPOINT_*` env vars; the app runs fine without them.
- `npm run lint` currently reports many pre-existing errors/warnings in app code — that is the repo's current state, not an environment problem.
- `npm run db:push` wraps a PowerShell script (Windows-only); on Linux use `npx supabase db push` (only relevant when targeting a remote project).
