-- Stockage des Word source des modèles MOA (financial-files).
-- Chemin : {owner_uuid}/owner-document-templates/{os|ae}/fichier.docx

DROP POLICY IF EXISTS financial_files_storage_owner_templates_insert ON storage.objects;
CREATE POLICY financial_files_storage_owner_templates_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'financial-files'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = 'owner-document-templates'
    AND public.can_manage_document_templates()
  );

DROP POLICY IF EXISTS financial_files_storage_owner_templates_select ON storage.objects;
CREATE POLICY financial_files_storage_owner_templates_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'financial-files'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = 'owner-document-templates'
  );

DROP POLICY IF EXISTS financial_files_storage_owner_templates_delete ON storage.objects;
CREATE POLICY financial_files_storage_owner_templates_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'financial-files'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = 'owner-document-templates'
    AND public.can_manage_document_templates()
  );
