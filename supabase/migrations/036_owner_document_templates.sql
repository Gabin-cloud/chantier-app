-- Modèles de documents OS / Acte d'engagement par maître d'ouvrage + catalogue d'étiquettes.

CREATE TABLE IF NOT EXISTS public.document_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  example TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_labels_key_format CHECK (key ~ '^[a-z][a-z0-9_]*$')
);

DROP TRIGGER IF EXISTS document_labels_updated_at ON public.document_labels;
CREATE TRIGGER document_labels_updated_at
  BEFORE UPDATE ON public.document_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.owner_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owner_directory(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('os', 'ae')),
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  enabled_label_keys TEXT[] NOT NULL DEFAULT '{}',
  source_file_path TEXT,
  source_file_name TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, doc_type)
);

DROP TRIGGER IF EXISTS owner_document_templates_updated_at ON public.owner_document_templates;
CREATE TRIGGER owner_document_templates_updated_at
  BEFORE UPDATE ON public.owner_document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS owner_document_templates_owner_idx
  ON public.owner_document_templates (owner_id);

ALTER TABLE public.document_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_document_templates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_document_templates()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'gestionnaire')
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_document_templates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_document_templates() TO authenticated;

DROP POLICY IF EXISTS document_labels_select ON public.document_labels;
CREATE POLICY document_labels_select ON public.document_labels
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS document_labels_write ON public.document_labels;
CREATE POLICY document_labels_write ON public.document_labels
  FOR ALL TO authenticated
  USING (public.can_manage_document_templates())
  WITH CHECK (public.can_manage_document_templates());

DROP POLICY IF EXISTS owner_document_templates_select ON public.owner_document_templates;
CREATE POLICY owner_document_templates_select ON public.owner_document_templates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS owner_document_templates_write ON public.owner_document_templates;
CREATE POLICY owner_document_templates_write ON public.owner_document_templates
  FOR ALL TO authenticated
  USING (public.can_manage_document_templates())
  WITH CHECK (public.can_manage_document_templates());

-- Étiquettes système de base (OS / AE).
INSERT INTO public.document_labels (key, label, description, example, category, is_system)
VALUES
  ('nom_operation', 'Nom de l''opération', 'Nom du chantier / opération', 'Résidence Les Jardins', 'operation', true),
  ('adresse_operation', 'Adresse opération', 'Adresse du chantier', '12 rue de la République', 'operation', true),
  ('code_postal_operation', 'Code postal opération', 'Code postal du chantier', '31000', 'operation', true),
  ('ville_operation', 'Ville opération', 'Ville du chantier', 'Toulouse', 'operation', true),
  ('nom_maitre_ouvrage', 'Nom maître d''ouvrage', 'Raison sociale du MOA', 'Ville de Toulouse', 'moa', true),
  ('adresse_maitre_ouvrage', 'Adresse maître d''ouvrage', 'Adresse du MOA', '1 place du Capitole', 'moa', true),
  ('code_postal_maitre_ouvrage', 'Code postal maître d''ouvrage', 'Code postal du MOA', '31000', 'moa', true),
  ('ville_maitre_ouvrage', 'Ville maître d''ouvrage', 'Ville du MOA', 'Toulouse', 'moa', true),
  ('signataire_maitre_ouvrage', 'Signataire maître d''ouvrage', 'Nom du signataire MOA', 'Mme Dupont', 'moa', true),
  ('mail_signataire_moa', 'Mail signataire MOA', 'E-mail du signataire MOA', 'dupont@ville-toulouse.fr', 'moa', true),
  ('nom_entreprise', 'Nom entreprise', 'Raison sociale de l''entreprise titulaire', 'SARL Comminges', 'entreprise', true),
  ('adresse_entreprise', 'Adresse entreprise', 'Adresse de l''entreprise', '45 avenue de Lyon', 'entreprise', true),
  ('code_postal_entreprise', 'Code postal entreprise', 'Code postal de l''entreprise', '31200', 'entreprise', true),
  ('ville_entreprise', 'Ville entreprise', 'Ville de l''entreprise', 'Toulouse', 'entreprise', true),
  ('siret_entreprise', 'SIRET entreprise', 'Numéro SIRET', '123 456 789 00012', 'entreprise', true),
  ('signataire_entreprise', 'Signataire entreprise', 'Nom du signataire entreprise', 'M. Martin', 'entreprise', true),
  ('lot_numero', 'N° de lot', 'Numéro du lot', '03', 'marche', true),
  ('lot_designation', 'Désignation du lot', 'Intitulé du lot', 'Cloisons / Doublages', 'marche', true),
  ('montant_marche_ht', 'Montant marché HT', 'Montant HT du marché', '125 000,00 €', 'marche', true),
  ('montant_marche_ttc', 'Montant marché TTC', 'Montant TTC du marché', '150 000,00 €', 'marche', true),
  ('taux_tva', 'Taux de TVA', 'Taux de TVA applicable', '20 %', 'marche', true),
  ('delai_paiement', 'Délai de paiement', 'Conditions / délai de paiement', '30 jours', 'marche', true),
  ('numero_os', 'N° d''OS', 'Numéro d''ordre de service', 'OS-2026-014', 'os', true),
  ('date_os', 'Date d''OS', 'Date de l''ordre de service', '16 juillet 2026', 'os', true),
  ('designation_travaux', 'Désignation des travaux', 'Objet des travaux / OS', 'Mise en œuvre cloisons R+2', 'os', true),
  ('delai_execution', 'Délai d''exécution', 'Délai d''exécution des travaux', '45 jours', 'os', true),
  ('date_jour', 'Date du jour', 'Date de rédaction du document', '16 juillet 2026', 'general', true),
  ('nom_moe', 'Nom maîtrise d''œuvre', 'Identité de la maîtrise d''œuvre', 'DANOBAT', 'moe', true)
ON CONFLICT (key) DO NOTHING;
