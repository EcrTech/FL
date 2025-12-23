-- Add policy for authenticated users to upload signed documents
CREATE POLICY "Authenticated users can upload loan documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT profiles.org_id::text 
    FROM profiles 
    WHERE profiles.id = auth.uid()
  )
);

-- Add policy to update objects (for signed document uploads)
CREATE POLICY "Org users can update their loan documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT profiles.org_id::text 
    FROM profiles 
    WHERE profiles.id = auth.uid()
  )
);

-- Add email column to loan_sanctions if it doesn't have emailed tracking
ALTER TABLE loan_sanctions ADD COLUMN IF NOT EXISTS documents_emailed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE loan_sanctions ADD COLUMN IF NOT EXISTS customer_email TEXT;