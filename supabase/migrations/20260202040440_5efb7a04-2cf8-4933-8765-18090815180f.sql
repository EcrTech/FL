-- Extend nupay_config table with Collection 360 credentials
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS access_key text;
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS access_secret text;
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS collection_api_endpoint text;
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS provider_id text;
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS collection_enabled boolean DEFAULT false;

-- Create nupay_upi_transactions table
CREATE TABLE IF NOT EXISTS nupay_upi_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_application_id uuid NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES loan_repayment_schedule(id) ON DELETE SET NULL,
  
  -- Nupay identifiers
  client_reference_id text NOT NULL UNIQUE,
  transaction_id text,
  customer_unique_id text,
  nupay_reference_id text,
  
  -- Transaction details
  request_amount numeric NOT NULL,
  transaction_amount numeric,
  convenience_fee numeric,
  gst_amount numeric,
  
  -- Payment info
  payment_link text,
  payee_vpa text,
  payer_vpa text,
  payer_name text,
  payer_mobile text,
  payer_email text,
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  status_description text,
  utr text,
  npci_transaction_id text,
  
  -- Timestamps
  expires_at timestamptz,
  transaction_timestamp timestamptz,
  
  -- Metadata
  request_payload jsonb,
  response_payload jsonb,
  webhook_payload jsonb,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create nupay_upi_auth_tokens table for caching short-lived tokens
CREATE TABLE IF NOT EXISTS nupay_upi_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  environment text NOT NULL,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, environment)
);

-- Enable RLS on new tables
ALTER TABLE nupay_upi_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nupay_upi_auth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for nupay_upi_transactions
CREATE POLICY "Users can view own org UPI transactions" ON nupay_upi_transactions
  FOR SELECT USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org UPI transactions" ON nupay_upi_transactions
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own org UPI transactions" ON nupay_upi_transactions
  FOR UPDATE USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- RLS policies for nupay_upi_auth_tokens
CREATE POLICY "Users can view own org auth tokens" ON nupay_upi_auth_tokens
  FOR SELECT USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage own org auth tokens" ON nupay_upi_auth_tokens
  FOR ALL USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nupay_upi_transactions_org_id ON nupay_upi_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_nupay_upi_transactions_schedule_id ON nupay_upi_transactions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_nupay_upi_transactions_status ON nupay_upi_transactions(status);
CREATE INDEX IF NOT EXISTS idx_nupay_upi_transactions_client_ref ON nupay_upi_transactions(client_reference_id);

-- Create updated_at trigger for nupay_upi_transactions
CREATE OR REPLACE FUNCTION update_nupay_upi_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nupay_upi_transactions_updated_at ON nupay_upi_transactions;
CREATE TRIGGER trigger_nupay_upi_transactions_updated_at
  BEFORE UPDATE ON nupay_upi_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_nupay_upi_transactions_updated_at();