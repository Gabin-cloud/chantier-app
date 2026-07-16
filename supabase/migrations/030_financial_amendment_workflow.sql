-- Workflow avenants : type (TS/TMA), statut de signature, commentaire interne

ALTER TABLE financial_amendments
  ADD COLUMN IF NOT EXISTS amendment_type TEXT NOT NULL DEFAULT 'ts'
    CHECK (amendment_type IN ('ts', 'tma'));

ALTER TABLE financial_amendments
  ADD COLUMN IF NOT EXISTS signature_status TEXT NOT NULL DEFAULT 'devis_recu_non_valide'
    CHECK (
      signature_status IN (
        'devis_recu_non_valide',
        'devis_valide_avenant_a_faire',
        'chez_entreprise',
        'chez_moe',
        'valide_classe'
      )
    );

ALTER TABLE financial_amendments
  ADD COLUMN IF NOT EXISTS internal_comment TEXT;

COMMENT ON COLUMN financial_amendments.amendment_type IS 'ts = travaux supplémentaires, tma = travaux modificatifs acquis';
COMMENT ON COLUMN financial_amendments.signature_status IS 'Étape de signature / validation de l''avenant';
COMMENT ON COLUMN financial_amendments.internal_comment IS 'Commentaire de suivi interne (affiché au survol dans la synthèse)';
