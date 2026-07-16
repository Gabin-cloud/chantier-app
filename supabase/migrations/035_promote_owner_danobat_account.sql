-- Compte propriétaire (gabin.alcouffe@free.fr) : accès DANOBAT PC/tablette.
-- Avait été classé « entreprise » par le backfill 033 (seuls rôles entreprise).

UPDATE public.profiles
SET
  account_kind = 'danobat',
  global_role = 'super_admin'
WHERE email = 'gabin.alcouffe@free.fr';
