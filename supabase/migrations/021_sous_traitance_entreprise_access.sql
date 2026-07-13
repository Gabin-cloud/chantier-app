-- Étape 1/2 : ajouter la valeur enum (doit être commitée seule avant utilisation)
ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'entreprise';
