-- Autoriser le sous-dossier situation-travaux dans les modèles MOA (financial-files).
-- Le chemin attendu : {owner_uuid}/owner-document-templates/situation-travaux/...

DROP POLICY IF EXISTS financial_files_storage_owner_templates_update ON storage.objects;
CREATE POLICY financial_files_storage_owner_templates_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'financial-files'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = 'owner-document-templates'
    AND public.can_manage_document_templates()
  )
  WITH CHECK (
    bucket_id = 'financial-files'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = 'owner-document-templates'
    AND public.can_manage_document_templates()
  );
