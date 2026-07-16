-- Statuts avenants : 3 étapes uniquement (chez entreprise, chez MOU, validé + classé)

UPDATE financial_amendments
SET signature_status = 'chez_entreprise'
WHERE signature_status IN ('devis_recu_non_valide', 'devis_valide_avenant_a_faire');

UPDATE financial_amendments
SET signature_status = 'chez_mou'
WHERE signature_status = 'chez_moe';

ALTER TABLE financial_amendments
  ALTER COLUMN signature_status SET DEFAULT 'chez_entreprise';

ALTER TABLE financial_amendments
  DROP CONSTRAINT IF EXISTS financial_amendments_signature_status_check;

ALTER TABLE financial_amendments
  ADD CONSTRAINT financial_amendments_signature_status_check
  CHECK (
    signature_status IN ('chez_entreprise', 'chez_mou', 'valide_classe')
  );
