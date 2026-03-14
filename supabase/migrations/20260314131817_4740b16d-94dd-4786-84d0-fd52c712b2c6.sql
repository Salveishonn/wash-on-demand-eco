INSERT INTO storage.buckets (id, name, public) VALUES ('booking-photos', 'booking-photos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload booking photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'booking-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view booking photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'booking-photos');

CREATE POLICY "Admins can delete booking photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'booking-photos' AND public.has_role(auth.uid(), 'admin'));