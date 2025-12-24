-- Create videokyc_recordings table
CREATE TABLE public.videokyc_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) NOT NULL,
  application_id UUID REFERENCES public.loan_applications(id) NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_phone TEXT,
  applicant_email TEXT,
  access_token TEXT UNIQUE,
  token_expires_at TIMESTAMPTZ,
  recording_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'recording', 'completed', 'failed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.videokyc_recordings ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users (org-based access)
CREATE POLICY "Users can view their org's videokyc recordings"
ON public.videokyc_recordings
FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert videokyc recordings for their org"
ON public.videokyc_recordings
FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their org's videokyc recordings"
ON public.videokyc_recordings
FOR UPDATE
USING (
  org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their org's videokyc recordings"
ON public.videokyc_recordings
FOR DELETE
USING (
  org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Create storage bucket for videokyc recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videokyc-recordings', 'videokyc-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for videokyc-recordings bucket
CREATE POLICY "Authenticated users can upload videokyc recordings"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'videokyc-recordings');

CREATE POLICY "Anyone can view videokyc recordings"
ON storage.objects
FOR SELECT
USING (bucket_id = 'videokyc-recordings');

CREATE POLICY "Authenticated users can update videokyc recordings"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'videokyc-recordings');

CREATE POLICY "Authenticated users can delete videokyc recordings"
ON storage.objects
FOR DELETE
USING (bucket_id = 'videokyc-recordings');

-- Create indexes for better query performance
CREATE INDEX idx_videokyc_recordings_application_id ON public.videokyc_recordings(application_id);
CREATE INDEX idx_videokyc_recordings_access_token ON public.videokyc_recordings(access_token);
CREATE INDEX idx_videokyc_recordings_status ON public.videokyc_recordings(status);