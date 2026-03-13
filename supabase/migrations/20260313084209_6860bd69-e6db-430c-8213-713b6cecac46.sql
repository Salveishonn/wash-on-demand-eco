UPDATE storage.buckets SET public = false WHERE id = 'invoices';
DROP POLICY IF EXISTS "Anyone can view invoice PDFs" ON storage.objects;