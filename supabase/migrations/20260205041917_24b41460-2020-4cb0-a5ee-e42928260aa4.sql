-- =============================================
-- SMS FUNCTIONALITY DATABASE SCHEMA
-- =============================================

-- 1. Add DLT compliance fields to exotel_settings
ALTER TABLE public.exotel_settings
ADD COLUMN IF NOT EXISTS sms_sender_id text,
ADD COLUMN IF NOT EXISTS dlt_entity_id text;

COMMENT ON COLUMN public.exotel_settings.sms_sender_id IS 'DLT-approved Sender ID (Header) for SMS';
COMMENT ON COLUMN public.exotel_settings.dlt_entity_id IS 'Principal Entity ID from DLT portal';

-- 2. Create sms_messages table
CREATE TABLE public.sms_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    loan_application_id uuid REFERENCES public.loan_applications(id) ON DELETE SET NULL,
    phone_number text NOT NULL,
    message_content text NOT NULL,
    template_id uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
    template_variables jsonb DEFAULT '{}'::jsonb,
    dlt_template_id text,
    exotel_sid text,
    status text NOT NULL DEFAULT 'pending',
    error_message text,
    sent_at timestamptz,
    delivered_at timestamptz,
    sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    trigger_type text NOT NULL DEFAULT 'manual',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sms_messages_status_check CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'undelivered')),
    CONSTRAINT sms_messages_trigger_type_check CHECK (trigger_type IN ('manual', 'automation', 'system'))
);

-- Create indexes for sms_messages
CREATE INDEX idx_sms_messages_org_id ON public.sms_messages(org_id);
CREATE INDEX idx_sms_messages_contact_id ON public.sms_messages(contact_id);
CREATE INDEX idx_sms_messages_loan_application_id ON public.sms_messages(loan_application_id);
CREATE INDEX idx_sms_messages_status ON public.sms_messages(status);
CREATE INDEX idx_sms_messages_created_at ON public.sms_messages(created_at DESC);
CREATE INDEX idx_sms_messages_exotel_sid ON public.sms_messages(exotel_sid);

-- Enable RLS on sms_messages
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_messages
CREATE POLICY "Users can view SMS messages in their org"
ON public.sms_messages FOR SELECT
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Users can insert SMS messages in their org"
ON public.sms_messages FOR INSERT
WITH CHECK (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Users can update SMS messages in their org"
ON public.sms_messages FOR UPDATE
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

-- 3. Create sms_automation_rules table
CREATE TABLE public.sms_automation_rules (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    trigger_type text NOT NULL,
    trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    condition_logic text DEFAULT 'AND',
    conditions jsonb DEFAULT '[]'::jsonb,
    sms_template_id uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
    send_delay_minutes integer DEFAULT 0,
    max_sends_per_contact integer DEFAULT 1,
    cooldown_period_days integer DEFAULT 0,
    priority integer DEFAULT 100,
    total_triggered integer DEFAULT 0,
    total_sent integer DEFAULT 0,
    total_failed integer DEFAULT 0,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sms_automation_rules_trigger_type_check CHECK (trigger_type IN (
        'stage_change', 'disposition_set', 'emandate_status', 'esign_status',
        'payment_due', 'loan_approved', 'loan_disbursed', 'document_uploaded'
    )),
    CONSTRAINT sms_automation_rules_condition_logic_check CHECK (condition_logic IN ('AND', 'OR'))
);

-- Create indexes for sms_automation_rules
CREATE INDEX idx_sms_automation_rules_org_id ON public.sms_automation_rules(org_id);
CREATE INDEX idx_sms_automation_rules_trigger_type ON public.sms_automation_rules(trigger_type);
CREATE INDEX idx_sms_automation_rules_is_active ON public.sms_automation_rules(is_active);

-- Enable RLS on sms_automation_rules
ALTER TABLE public.sms_automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_automation_rules
CREATE POLICY "Users can view SMS automation rules in their org"
ON public.sms_automation_rules FOR SELECT
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Users can insert SMS automation rules in their org"
ON public.sms_automation_rules FOR INSERT
WITH CHECK (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Users can update SMS automation rules in their org"
ON public.sms_automation_rules FOR UPDATE
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Users can delete SMS automation rules in their org"
ON public.sms_automation_rules FOR DELETE
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

-- 4. Create sms_automation_executions table
CREATE TABLE public.sms_automation_executions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_id uuid NOT NULL REFERENCES public.sms_automation_rules(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    loan_application_id uuid REFERENCES public.loan_applications(id) ON DELETE SET NULL,
    trigger_type text NOT NULL,
    trigger_data jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    sms_message_id uuid REFERENCES public.sms_messages(id) ON DELETE SET NULL,
    scheduled_for timestamptz,
    sent_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sms_automation_executions_status_check CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'skipped', 'cancelled'))
);

-- Create indexes for sms_automation_executions
CREATE INDEX idx_sms_automation_executions_org_id ON public.sms_automation_executions(org_id);
CREATE INDEX idx_sms_automation_executions_rule_id ON public.sms_automation_executions(rule_id);
CREATE INDEX idx_sms_automation_executions_contact_id ON public.sms_automation_executions(contact_id);
CREATE INDEX idx_sms_automation_executions_status ON public.sms_automation_executions(status);
CREATE INDEX idx_sms_automation_executions_scheduled_for ON public.sms_automation_executions(scheduled_for);

-- Enable RLS on sms_automation_executions
ALTER TABLE public.sms_automation_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_automation_executions
CREATE POLICY "Users can view SMS automation executions in their org"
ON public.sms_automation_executions FOR SELECT
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Users can insert SMS automation executions in their org"
ON public.sms_automation_executions FOR INSERT
WITH CHECK (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Users can update SMS automation executions in their org"
ON public.sms_automation_executions FOR UPDATE
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

-- 5. Create sms_automation_cooldowns table (to track per-contact cooldowns)
CREATE TABLE public.sms_automation_cooldowns (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_id uuid NOT NULL REFERENCES public.sms_automation_rules(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    last_sent_at timestamptz NOT NULL DEFAULT now(),
    send_count integer NOT NULL DEFAULT 1,
    CONSTRAINT sms_automation_cooldowns_unique UNIQUE (org_id, rule_id, contact_id)
);

-- Create indexes for sms_automation_cooldowns
CREATE INDEX idx_sms_automation_cooldowns_lookup ON public.sms_automation_cooldowns(org_id, rule_id, contact_id);

-- Enable RLS on sms_automation_cooldowns
ALTER TABLE public.sms_automation_cooldowns ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_automation_cooldowns
CREATE POLICY "Users can view SMS automation cooldowns in their org"
ON public.sms_automation_cooldowns FOR SELECT
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Users can manage SMS automation cooldowns in their org"
ON public.sms_automation_cooldowns FOR ALL
USING (
    org_id IN (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

-- 6. Create updated_at triggers
CREATE TRIGGER update_sms_messages_updated_at
BEFORE UPDATE ON public.sms_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_automation_rules_updated_at
BEFORE UPDATE ON public.sms_automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_automation_executions_updated_at
BEFORE UPDATE ON public.sms_automation_executions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Enable realtime for sms_messages (for dashboard updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;