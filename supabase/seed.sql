-- Local development seed (executed by the Supabase CLI on `supabase start` / `supabase db reset`).
-- NOT used in production (Supabase Cloud applies these grants automatically).
--
-- Why this is needed: in the local stack, migrations run as the `postgres` role, whose
-- default privileges only grant TRUNCATE/REFERENCES/TRIGGER to anon/authenticated/service_role.
-- Supabase Cloud grants full table DML to those roles, so without this file the app hits
-- "permission denied for table ..." for every logged-in query. Row Level Security policies
-- (defined in the migrations) remain the real access gate.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
