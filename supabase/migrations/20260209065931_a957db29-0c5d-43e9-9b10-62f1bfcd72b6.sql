CREATE POLICY "Authenticated users can view signed loan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] = 'signed'
);