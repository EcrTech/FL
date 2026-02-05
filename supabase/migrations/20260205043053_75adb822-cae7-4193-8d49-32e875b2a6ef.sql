-- Create SMS templates table for DLT-compliant templates
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dlt_template_id TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'transactional',
  language TEXT DEFAULT 'en',
  char_count INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (use IF NOT EXISTS pattern)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_templates' AND policyname = 'Users can view SMS templates in their organization'
  ) THEN
    CREATE POLICY "Users can view SMS templates in their organization"
      ON public.sms_templates FOR SELECT
      USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_templates' AND policyname = 'Users can create SMS templates in their organization'
  ) THEN
    CREATE POLICY "Users can create SMS templates in their organization"
      ON public.sms_templates FOR INSERT
      WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_templates' AND policyname = 'Users can update SMS templates in their organization'
  ) THEN
    CREATE POLICY "Users can update SMS templates in their organization"
      ON public.sms_templates FOR UPDATE
      USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_templates' AND policyname = 'Users can delete SMS templates in their organization'
  ) THEN
    CREATE POLICY "Users can delete SMS templates in their organization"
      ON public.sms_templates FOR DELETE
      USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_sms_templates_updated_at ON public.sms_templates;
CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_templates_org_id ON public.sms_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_sms_templates_dlt_template_id ON public.sms_templates(dlt_template_id);