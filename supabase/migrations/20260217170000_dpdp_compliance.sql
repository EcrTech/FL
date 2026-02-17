-- DPDP Act 2023 Compliance: Tables, Functions, Triggers, and RLS Policies
-- Digital Personal Data Protection Act compliance for CRM/LOS application

-- 1a. Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1b. Consent Records Table
-- ============================================================
CREATE TABLE IF NOT EXISTS dpdp_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  applicant_id UUID REFERENCES loan_applicants(id) ON DELETE SET NULL,
  user_identifier TEXT NOT NULL, -- phone or email
  consent_version TEXT NOT NULL DEFAULT '1.0',
  purpose TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dpdp_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to consent records"
  ON dpdp_consent_records FOR ALL
  USING (org_id = get_user_org_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Staff can view consent records"
  ON dpdp_consent_records FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Anon insert consent records"
  ON dpdp_consent_records FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 1c. Data Rights Requests Table
-- ============================================================
CREATE TABLE IF NOT EXISTS dpdp_data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  applicant_id UUID REFERENCES loan_applicants(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_phone TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'erasure', 'correction', 'nomination', 'grievance')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days'),
  completed_at TIMESTAMPTZ,
  admin_notes TEXT,
  handled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dpdp_data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to data requests"
  ON dpdp_data_requests FOR ALL
  USING (org_id = get_user_org_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Staff can view data requests"
  ON dpdp_data_requests FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Staff can update data requests"
  ON dpdp_data_requests FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Anon insert data requests"
  ON dpdp_data_requests FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 1d. Breach Notifications Table
-- ============================================================
CREATE TABLE IF NOT EXISTS dpdp_breach_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT,
  remedial_steps TEXT,
  contact_info TEXT,
  affected_count INTEGER DEFAULT 0,
  notified_board BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dpdp_breach_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to breach notifications"
  ON dpdp_breach_notifications FOR ALL
  USING (org_id = get_user_org_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Staff can view breach notifications"
  ON dpdp_breach_notifications FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

-- ============================================================
-- 1e. PII Access Log Table (Immutable Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS dpdp_pii_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  applicant_id UUID REFERENCES loan_applicants(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  column_name TEXT,
  purpose TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dpdp_pii_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view PII access log"
  ON dpdp_pii_access_log FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE POLICY "System insert PII access log"
  ON dpdp_pii_access_log FOR INSERT
  WITH CHECK (true);

-- No UPDATE or DELETE policies — immutable audit trail

-- ============================================================
-- 1f. PII Encryption Functions
-- ============================================================
CREATE OR REPLACE FUNCTION encrypt_pii(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;

  -- Try to get key from vault, fall back to app setting
  BEGIN
    SELECT decrypted_secret INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'PII_ENCRYPTION_KEY'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    encryption_key := current_setting('app.pii_encryption_key', true);
  END;

  IF encryption_key IS NULL OR encryption_key = '' THEN
    -- If no key configured, return NULL (don't encrypt without key)
    RETURN NULL;
  END IF;

  RETURN pgp_sym_encrypt(plaintext, encryption_key);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'PII_ENCRYPTION_KEY'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    encryption_key := current_setting('app.pii_encryption_key', true);
  END;

  IF encryption_key IS NULL OR encryption_key = '' THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(ciphertext, encryption_key);
END;
$$;

-- ============================================================
-- 1g. Auto-Encryption Trigger on contacts
-- ============================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_encrypted BYTEA;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_encrypted BYTEA;

CREATE OR REPLACE FUNCTION encrypt_contact_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  -- Encrypt phone
  IF NEW.phone IS NOT NULL AND NEW.phone != '' AND NEW.phone NOT LIKE '****%' THEN
    NEW.phone_encrypted := encrypt_pii(NEW.phone);
    -- Mask plaintext: show last 4 digits
    IF length(NEW.phone) >= 4 THEN
      NEW.phone := '****' || right(NEW.phone, 4);
    END IF;
  END IF;

  -- Encrypt email
  IF NEW.email IS NOT NULL AND NEW.email != '' AND NEW.email NOT LIKE '%***@%' THEN
    NEW.email_encrypted := encrypt_pii(NEW.email);
    -- Mask plaintext: u***@domain.com
    IF position('@' IN NEW.email) > 0 THEN
      NEW.email := left(split_part(NEW.email, '@', 1), 1) || '***@' || split_part(NEW.email, '@', 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_contact_pii ON contacts;
CREATE TRIGGER trg_encrypt_contact_pii
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_contact_pii();

-- ============================================================
-- 1h. Auto-Encryption Trigger on loan_applicants
-- ============================================================
ALTER TABLE loan_applicants ADD COLUMN IF NOT EXISTS mobile_encrypted BYTEA;
ALTER TABLE loan_applicants ADD COLUMN IF NOT EXISTS email_encrypted BYTEA;
ALTER TABLE loan_applicants ADD COLUMN IF NOT EXISTS aadhaar_encrypted BYTEA;
ALTER TABLE loan_applicants ADD COLUMN IF NOT EXISTS pan_encrypted BYTEA;
ALTER TABLE loan_applicants ADD COLUMN IF NOT EXISTS bank_account_encrypted BYTEA;
ALTER TABLE loan_applicants ADD COLUMN IF NOT EXISTS bank_ifsc_encrypted BYTEA;
ALTER TABLE loan_applicants ADD COLUMN IF NOT EXISTS alternate_mobile_encrypted BYTEA;

CREATE OR REPLACE FUNCTION encrypt_applicant_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  -- Encrypt mobile
  IF NEW.mobile IS NOT NULL AND NEW.mobile != '' AND NEW.mobile NOT LIKE '****%' THEN
    NEW.mobile_encrypted := encrypt_pii(NEW.mobile);
    IF length(NEW.mobile) >= 4 THEN
      NEW.mobile := '****' || right(NEW.mobile, 4);
    END IF;
  END IF;

  -- Encrypt email
  IF NEW.email IS NOT NULL AND NEW.email != '' AND NEW.email NOT LIKE '%***@%' THEN
    NEW.email_encrypted := encrypt_pii(NEW.email);
    IF position('@' IN NEW.email) > 0 THEN
      NEW.email := left(split_part(NEW.email, '@', 1), 1) || '***@' || split_part(NEW.email, '@', 2);
    END IF;
  END IF;

  -- Encrypt aadhaar
  IF NEW.aadhaar_number IS NOT NULL AND NEW.aadhaar_number != '' AND NEW.aadhaar_number NOT LIKE 'XXXX%' THEN
    NEW.aadhaar_encrypted := encrypt_pii(NEW.aadhaar_number);
    -- Mask: XXXX XXXX 1234
    IF length(regexp_replace(NEW.aadhaar_number, '[^0-9]', '', 'g')) >= 4 THEN
      NEW.aadhaar_number := 'XXXX XXXX ' || right(regexp_replace(NEW.aadhaar_number, '[^0-9]', '', 'g'), 4);
    END IF;
  END IF;

  -- Encrypt PAN
  IF NEW.pan_number IS NOT NULL AND NEW.pan_number != '' AND NEW.pan_number NOT LIKE 'XXXXX%' THEN
    NEW.pan_encrypted := encrypt_pii(NEW.pan_number);
    -- Mask: XXXXX1234X
    IF length(NEW.pan_number) = 10 THEN
      NEW.pan_number := 'XXXXX' || substring(NEW.pan_number FROM 6 FOR 4) || right(NEW.pan_number, 1);
    END IF;
  END IF;

  -- Encrypt bank account number
  IF NEW.bank_account_number IS NOT NULL AND NEW.bank_account_number != '' AND NEW.bank_account_number NOT LIKE '****%' THEN
    NEW.bank_account_encrypted := encrypt_pii(NEW.bank_account_number);
    IF length(NEW.bank_account_number) >= 4 THEN
      NEW.bank_account_number := '****' || right(NEW.bank_account_number, 4);
    END IF;
  END IF;

  -- Encrypt bank IFSC
  IF NEW.bank_ifsc_code IS NOT NULL AND NEW.bank_ifsc_code != '' AND NEW.bank_ifsc_code NOT LIKE '****%' THEN
    NEW.bank_ifsc_encrypted := encrypt_pii(NEW.bank_ifsc_code);
    IF length(NEW.bank_ifsc_code) >= 4 THEN
      NEW.bank_ifsc_code := '****' || right(NEW.bank_ifsc_code, 4);
    END IF;
  END IF;

  -- Encrypt alternate mobile
  IF NEW.alternate_mobile IS NOT NULL AND NEW.alternate_mobile != '' AND NEW.alternate_mobile NOT LIKE '****%' THEN
    NEW.alternate_mobile_encrypted := encrypt_pii(NEW.alternate_mobile);
    IF length(NEW.alternate_mobile) >= 4 THEN
      NEW.alternate_mobile := '****' || right(NEW.alternate_mobile, 4);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_applicant_pii ON loan_applicants;
CREATE TRIGGER trg_encrypt_applicant_pii
  BEFORE INSERT OR UPDATE ON loan_applicants
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_applicant_pii();

-- ============================================================
-- 1i. Secure Decryption RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION get_contact_decrypted(p_contact_id UUID)
RETURNS TABLE(
  contact_id UUID,
  phone TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_org_id := get_user_org_id(v_user_id);

  -- Verify the contact belongs to the user's org
  IF NOT EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = p_contact_id AND c.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Access denied: contact not in your organization';
  END IF;

  -- Log the PII access
  INSERT INTO dpdp_pii_access_log (org_id, user_id, contact_id, table_name, column_name, purpose)
  VALUES (v_org_id, v_user_id, p_contact_id, 'contacts', 'phone,email', 'decryption_request');

  RETURN QUERY
  SELECT
    c.id AS contact_id,
    decrypt_pii(c.phone_encrypted) AS phone,
    decrypt_pii(c.email_encrypted) AS email
  FROM contacts c
  WHERE c.id = p_contact_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_applicant_decrypted(p_applicant_id UUID)
RETURNS TABLE(
  applicant_id UUID,
  mobile TEXT,
  email TEXT,
  aadhaar_number TEXT,
  pan_number TEXT,
  bank_account_number TEXT,
  bank_ifsc_code TEXT,
  alternate_mobile TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_org_id := get_user_org_id(v_user_id);

  -- Verify the applicant belongs to the user's org
  IF NOT EXISTS (
    SELECT 1 FROM loan_applicants a WHERE a.id = p_applicant_id AND a.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Access denied: applicant not in your organization';
  END IF;

  -- Log the PII access
  INSERT INTO dpdp_pii_access_log (org_id, user_id, applicant_id, table_name, column_name, purpose)
  VALUES (v_org_id, v_user_id, p_applicant_id, 'loan_applicants', 'mobile,email,aadhaar,pan,bank_account,ifsc,alt_mobile', 'decryption_request');

  RETURN QUERY
  SELECT
    a.id AS applicant_id,
    decrypt_pii(a.mobile_encrypted) AS mobile,
    decrypt_pii(a.email_encrypted) AS email,
    decrypt_pii(a.aadhaar_encrypted) AS aadhaar_number,
    decrypt_pii(a.pan_encrypted) AS pan_number,
    decrypt_pii(a.bank_account_encrypted) AS bank_account_number,
    decrypt_pii(a.bank_ifsc_encrypted) AS bank_ifsc_code,
    decrypt_pii(a.alternate_mobile_encrypted) AS alternate_mobile
  FROM loan_applicants a
  WHERE a.id = p_applicant_id;
END;
$$;

-- ============================================================
-- 1j. Dashboard Stats RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_dpdp_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_consent_records', (SELECT count(*) FROM dpdp_consent_records WHERE org_id = p_org_id),
    'active_consents', (SELECT count(*) FROM dpdp_consent_records WHERE org_id = p_org_id AND withdrawn_at IS NULL),
    'withdrawn_consents', (SELECT count(*) FROM dpdp_consent_records WHERE org_id = p_org_id AND withdrawn_at IS NOT NULL),
    'pending_requests', (SELECT count(*) FROM dpdp_data_requests WHERE org_id = p_org_id AND status = 'pending'),
    'overdue_requests', (SELECT count(*) FROM dpdp_data_requests WHERE org_id = p_org_id AND status IN ('pending', 'in_progress') AND due_date < now()),
    'total_pii_accesses', (SELECT count(*) FROM dpdp_pii_access_log WHERE org_id = p_org_id),
    'today_pii_accesses', (SELECT count(*) FROM dpdp_pii_access_log WHERE org_id = p_org_id AND accessed_at >= CURRENT_DATE),
    'breach_count', (SELECT count(*) FROM dpdp_breach_notifications WHERE org_id = p_org_id)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_dpdp_consent_org ON dpdp_consent_records(org_id);
CREATE INDEX IF NOT EXISTS idx_dpdp_consent_contact ON dpdp_consent_records(contact_id);
CREATE INDEX IF NOT EXISTS idx_dpdp_consent_applicant ON dpdp_consent_records(applicant_id);
CREATE INDEX IF NOT EXISTS idx_dpdp_requests_org ON dpdp_data_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_dpdp_requests_status ON dpdp_data_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_dpdp_breach_org ON dpdp_breach_notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_dpdp_pii_log_org ON dpdp_pii_access_log(org_id);
CREATE INDEX IF NOT EXISTS idx_dpdp_pii_log_accessed ON dpdp_pii_access_log(org_id, accessed_at);
