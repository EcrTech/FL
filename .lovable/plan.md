
# UPI Collection Integration with Nupay Collection 360

## Overview
Integrate Nupay's Collection 360 API to enable UPI-based EMI collections in the Collections module. This will allow generating payment QR codes/links for pending EMIs and auto-reconciling payments via webhooks.

---

## API Summary from Documentation

| API | Endpoint | Purpose |
|-----|----------|---------|
| Get Access Token | POST `/onboarding/v1/users/accesstoken` | Generate JWT (30 min expiry) using `access_key` + `access_secret` |
| Create Collect Request | POST `/collect360/v1/initiate_transaction` | Generate Dynamic QR, UPI Intent URL, or VPA Collect |
| Get Transaction Status | GET `/collect360/v1/transactionEnquiry/:client_reference_id` | Check payment status |
| Get Transaction Statement | GET `/collect360/v1/transactionStatement` | Fetch transaction history |

**Key Differences from eMandate API:**
- Uses `access_key` + `access_secret` (not just `api_key`)
- Different endpoint base: `https://api-uat.nupaybiz.com` (UAT) / `https://api.nupaybiz.com` (Prod)
- Requires `NP-Request-ID`, `x-api-key`, and `Authorization` headers
- Token expires in 30 minutes (vs 30 days for eMandate)

---

## Database Schema Changes

### 1. Extend `nupay_config` table

Add Collection 360-specific credentials:
```sql
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS access_key text;
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS access_secret text;
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS collection_api_endpoint text;
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS provider_id text;
ALTER TABLE nupay_config ADD COLUMN IF NOT EXISTS collection_enabled boolean DEFAULT false;
```

### 2. Create `nupay_upi_transactions` table

Track UPI collection requests and their status:
```sql
CREATE TABLE nupay_upi_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  loan_application_id uuid NOT NULL REFERENCES loan_applications(id),
  schedule_id uuid REFERENCES loan_repayment_schedule(id),
  
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

-- RLS policies
ALTER TABLE nupay_upi_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org transactions" ON nupay_upi_transactions
  FOR SELECT USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org transactions" ON nupay_upi_transactions
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));
```

### 3. Create `nupay_upi_auth_tokens` table

Cache short-lived tokens (30 min expiry):
```sql
CREATE TABLE nupay_upi_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  environment text NOT NULL,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, environment)
);
```

---

## Edge Functions to Create

### 1. `nupay-collection-authenticate`

Generate JWT token for Collection 360 API.

```text
POST /nupay-collection-authenticate
Body: { org_id, environment }
Response: { success, token, expires_at }
```

Key logic:
- Check `nupay_upi_auth_tokens` for valid cached token
- If expired, call `/onboarding/v1/users/accesstoken` with `access_key` + `access_secret`
- Cache new token (set expiry to 25 min to be safe)
- Return token

### 2. `nupay-create-upi-collection`

Initiate a UPI collection request for an EMI.

```text
POST /nupay-create-upi-collection
Body: {
  org_id,
  environment,
  schedule_id,
  loan_application_id,
  loan_id,
  emi_number,
  amount,
  payer_name,
  payer_mobile,
  payer_email (optional)
}
Response: {
  success,
  transaction_id,
  payment_link,
  payee_vpa,
  expires_at,
  qr_data
}
```

Key logic:
- Generate unique `client_reference_id` (format: `EMI_{schedule_id}_{timestamp}`)
- Get auth token via `nupay-collection-authenticate`
- Call `/collect360/v1/initiate_transaction`
- Store in `nupay_upi_transactions`
- Return payment link and QR data

### 3. `nupay-collection-status`

Check transaction status.

```text
GET /nupay-collection-status?client_reference_id=XXX
Response: { status, utr, amount, payer_vpa, ... }
```

### 4. `nupay-collection-webhook`

Handle incoming webhooks from Nupay.

```text
POST /nupay-collection-webhook
Body: { client_reference_id, transaction_status, utr, ... }
```

Key logic:
- Parse webhook payload
- Update `nupay_upi_transactions` status
- If `SUCCESS`: Auto-record payment in `loan_payments` and update `loan_repayment_schedule`
- If `FAILED` or `REJECTED`: Update status only

---

## Frontend Changes

### 1. Update `NupaySettings.tsx`

Add Collection 360 configuration section:
- Access Key input
- Access Secret input
- Collection API Endpoint
- Provider ID
- Enable/Disable Collection toggle
- Test Connection button

### 2. Create `UPICollectionDialog.tsx`

New dialog for initiating UPI collection:

```text
+----------------------------------+
|    Collect EMI via UPI           |
+----------------------------------+
| Application: APP-2024-001        |
| EMI #3 | Due: 15 Feb 2026        |
| Amount: Rs 5,250                 |
+----------------------------------+
| [ Generate Payment Link ]        |
+----------------------------------+
| (After generation)               |
| +-----------------------------+  |
| |      [QR CODE]              |  |
| +-----------------------------+  |
| Payment Link: npay.biz/xxx       |
| [ Copy Link ] [ Share WhatsApp ] |
| Status: Pending                  |
| [ Refresh Status ]               |
+----------------------------------+
```

### 3. Update `CollectionsTable.tsx`

Add "Collect UPI" button alongside existing "Pay" button:
- Show for pending/overdue EMIs
- Opens `UPICollectionDialog`

### 4. Create `useUPICollection.ts` hook

Handle UPI collection operations:
- `initiateCollection(scheduleId, amount, ...)`
- `checkStatus(clientReferenceId)`
- Query for existing transactions

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/nupay-collection-authenticate/index.ts` | CREATE | Auth token generation |
| `supabase/functions/nupay-create-upi-collection/index.ts` | CREATE | Initiate UPI collection |
| `supabase/functions/nupay-collection-status/index.ts` | CREATE | Check transaction status |
| `supabase/functions/nupay-collection-webhook/index.ts` | CREATE | Handle webhooks, auto-reconcile |
| `src/pages/LOS/NupaySettings.tsx` | MODIFY | Add Collection 360 config section |
| `src/components/LOS/Collections/UPICollectionDialog.tsx` | CREATE | UPI payment initiation UI |
| `src/components/LOS/Collections/CollectionsTable.tsx` | MODIFY | Add "Collect UPI" action |
| `src/hooks/useUPICollection.ts` | CREATE | UPI collection hook |

---

## Integration Flow

```text
COLLECTION INITIATION:
+------------------+     +------------------------+     +---------------------+
| Collections UI   |---->| nupay-create-upi-      |---->| Nupay Collection    |
| "Collect UPI"    |     | collection             |     | 360 API             |
+------------------+     +------------------------+     +---------------------+
         |                         |                            |
         |                         v                            |
         |               Store in nupay_upi_transactions        |
         |                         |                            |
         v                         v                            v
    Show QR + Link  <--------  payment_link  <---------  API Response

PAYMENT COMPLETION:
+------------------+     +------------------------+     +---------------------+
| Customer pays    |---->| Nupay webhook          |---->| nupay-collection-   |
| via UPI          |     | POST to our endpoint   |     | webhook             |
+------------------+     +------------------------+     +---------------------+
                                                               |
                                    +------------------<-------+
                                    |
                                    v
                         +---------------------+
                         | If SUCCESS:         |
                         | - Update txn status |
                         | - Insert payment    |
                         | - Update schedule   |
                         +---------------------+
```

---

## Technical Notes

### Token Management
Collection 360 tokens expire in 30 minutes (vs 30 days for eMandate). The `nupay-collection-authenticate` function will:
1. Check `nupay_upi_auth_tokens` for valid token (with 5 min buffer)
2. If expired, request new token
3. Cache with 25 min expiry (5 min safety buffer)

### Client Reference ID Format
Format: `EMI_{schedule_id_first8chars}_{timestamp_ms}`
Example: `EMI_a1b2c3d4_1706832000000`
Length: 8-14 characters (API limit)

### Webhook Auto-Reconciliation
When webhook receives `SUCCESS`:
1. Find `nupay_upi_transactions` by `client_reference_id`
2. Get linked `schedule_id` and `loan_application_id`
3. Insert into `loan_payments`:
   - `payment_method`: 'upi_collection'
   - `transaction_reference`: UTR from webhook
4. Update `loan_repayment_schedule` status

### Error Handling
- Token expiry: Auto-refresh on 401/403
- Duplicate request (NP4008): Return existing transaction
- Rate limit (NP4006): Implement exponential backoff

---

## Configuration Required

Users need to obtain from Nupay:
1. `access_key` (public key, format: `nu_pub_xxx`)
2. `access_secret` (private key, format: `nu_prv_xxx`)
3. `provider_id` (service provider identifier)

These are configured in the Nupay Settings page under a new "Collection 360" tab.
