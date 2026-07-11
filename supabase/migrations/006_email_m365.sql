-- Phase 9 : profil utilisateur, connexion M365, préférences de notification

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_new_projects BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.user_m365_connections (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ms_user_id TEXT NOT NULL,
  ms_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS user_m365_connections_updated_at ON public.user_m365_connections;
CREATE TRIGGER user_m365_connections_updated_at
  BEFORE UPDATE ON public.user_m365_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.user_m365_connections ENABLE ROW LEVEL SECURITY;

-- Tokens M365 : accès serveur uniquement (service role). Aucune policy = pas d'accès client.
