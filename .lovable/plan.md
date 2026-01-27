
# Nupay E-Sign on Document API Integration

## Overview
This plan implements a complete Aadhaar-based e-Sign solution using Nupay's E-Sign on Document API. The integration will allow borrowers to digitally sign loan documents (Sanction Letter, Loan Agreement, Daily Repayment Schedule) using Aadhaar OTP authentication, making the signed documents legally binding.

## API Summary (from Documentation)

| API | Method | Endpoint | Purpose |
|-----|--------|----------|---------|
| Get Token | GET | `/Auth/token` | Authenticate and get JWT token |
| E-Sign Request | POST | `/api/SignDocument/signRequest` | Initiate document signing |
| Get Status | POST | `/api/SignDocument/documentStatus` | Check signing status |

### Key API Parameters
- **document**: Base64-encoded PDF document
- **no_of_signer**: Number of signers (max 4)
- **signer_info**: Array with name, email, mobile, and signature appearance position
- **appearance**: Position options - `bottom-left`, `bottom-right`, `top-left`, `top-right`

### Response Data
- **docket_id**: Unique document identifier
- **signer_url**: URL sent to signer to complete signing
- **document_id**: For status tracking

---

## Architecture

```text
+------------------+     +-------------------+     +------------------+
|  LOS Dashboard   | --> | nupay-esign-*     | --> | Nupay E-Sign API |
|  (React UI)      |     | Edge Functions    |     | (nupaybiz.com)   |
+------------------+     +-------------------+     +------------------+
        |                        |
        v                        v
+------------------+     +-------------------+
| loan_generated_  | <-- | document_esign_   |
| documents table  |     | requests table    |
+------------------+     +-------------------+
```

---

## Implementation Steps

### Phase 1: Database Schema Updates

**1.1 Add Nupay-specific columns to `document_esign_requests`**

| Column | Type | Purpose |
|--------|------|---------|
| `nupay_docket_id` | TEXT | Nupay's unique document tracking ID |
| `nupay_document_id` | TEXT | Document ID for status queries |
| `nupay_ref_no` | TEXT | Our reference number sent to Nupay |
| `signer_url` | TEXT | URL for signer to complete e-signing |
| `signer_sequence` | INTEGER | Order of signing (1-4) |
| `esign_response` | JSONB | Full API response for debugging |

**1.2 Update `nupay_config` for E-Sign**

The existing `nupay_config` table already stores API credentials per organization. The same `api_key` and `api_endpoint` will be used for E-Sign API calls.

---

### Phase 2: Edge Functions

**2.1 `nupay-esign-request` - Initiate E-Sign**

Purpose: Convert document to PDF, encode as Base64, and send to Nupay for signing

```text
Input:
  - application_id: UUID
  - document_type: 'sanction_letter' | 'loan_agreement' | 'daily_schedule'
  - signer_info: { name, email, mobile, appearance }

Process:
  1. Authenticate via nupay-authenticate (reuse existing)
  2. Fetch document HTML from loan_generated_documents
  3. Convert HTML to PDF using jsPDF/html2canvas (server-side)
  4. Encode PDF as Base64
  5. Generate unique nupay_ref_no: "ESIGN-{app_number}-{timestamp}"
  6. Call Nupay signRequest API
  7. Store response in document_esign_requests
  8. Return signer URL for sharing

Output:
  - success: boolean
  - signer_url: string (URL for borrower to sign)
  - esign_request_id: UUID
```

**2.2 `nupay-esign-status` - Check Signing Status**

Purpose: Query Nupay for document signing status

```text
Input:
  - esign_request_id: UUID (our record ID)
  OR
  - nupay_document_id: string

Process:
  1. Authenticate via nupay-authenticate
  2. Call Nupay documentStatus API
  3. Update document_esign_requests with status
  4. If signed, update loan_generated_documents

Output:
  - status: 'pending' | 'signed' | 'expired' | 'failed'
  - signer_info: Array of signer statuses
  - signed_at: timestamp (if completed)
```

**2.3 `nupay-esign-webhook` - Receive Status Updates (Optional)**

Purpose: Handle webhook callbacks from Nupay when signing is completed

```text
Process:
  1. Validate webhook signature
  2. Parse document_id from payload
  3. Update document_esign_requests status
  4. If all signers completed, mark document as signed
  5. Trigger notification to loan officer
```

---

### Phase 3: PDF Generation (Server-Side)

Since the current implementation generates HTML client-side with `html2pdf.js`, we need a server-side PDF generation approach for the Edge Function:

**Option A: Use Deno's pdf-lib library**
- Generate PDF directly from structured data
- Lightweight and runs in Deno

**Option B: Use external HTML-to-PDF service**
- Send HTML to a service like html2pdf.org API
- More complex but preserves existing templates

**Recommended: Option A** - Create PDF templates programmatically using pdf-lib for reliability and speed.

---

### Phase 4: Frontend Components

**4.1 `ESignDocumentButton` Component**

Location: `src/components/LOS/Sanction/ESignDocumentButton.tsx`

```text
Props:
  - applicationId: string
  - documentType: string
  - documentId: string
  - signerName: string
  - signerEmail: string
  - signerPhone: string
  - onSuccess: () => void

Features:
  - Show "Send for E-Sign" button
  - Loading state during API call
  - Display signer URL / copy to clipboard
  - Option to send via WhatsApp/SMS
```

**4.2 `ESignStatusBadge` Component**

Location: `src/components/LOS/Sanction/ESignStatusBadge.tsx`

```text
Props:
  - status: 'pending' | 'sent' | 'viewed' | 'signed' | 'expired'
  - signedAt?: Date

Display:
  - Color-coded badge with status
  - Tooltip with timestamp details
```

**4.3 `ESignDocumentDialog` Component**

Location: `src/components/LOS/Sanction/ESignDocumentDialog.tsx`

```text
Features:
  - Confirm signer details before sending
  - Select signature appearance position
  - Preview document before sending
  - Send button with confirmation
```

---

### Phase 5: Integration Points

**5.1 Update `DisbursementDashboard.tsx`**

Add E-Sign option alongside existing "Download PDF" and "Upload Signed" buttons:

```text
Document Actions:
  - [Generate] - Create document
  - [Download PDF] - Existing functionality
  - [Send for E-Sign] - NEW: Opens ESignDocumentDialog
  - [Upload Signed] - Manual fallback
  - [Check Status] - Query Nupay for updates
```

**5.2 Update `send-sanction-documents` Edge Function**

After generating documents, optionally initiate E-Sign request:

```text
Options:
  - Send via email only (current behavior)
  - Send via email + initiate E-Sign
  - Initiate E-Sign only (no email)
```

---

### Phase 6: Status Tracking & Notifications

**6.1 Polling/Webhook for Status Updates**

```text
Approach:
  1. After sending E-Sign request, start polling (every 2 minutes)
  2. Stop polling after 24 hours or when signed
  3. Alternatively, configure webhook URL in Nupay dashboard
```

**6.2 Notification on Completion**

When document is signed:
- Update `loan_generated_documents.status` to 'signed'
- Update `loan_generated_documents.customer_signed` to true
- Store signed PDF URL
- Notify loan officer via in-app notification
- Optionally send confirmation email to borrower

---

## Required Secrets

No new secrets required - the integration uses existing `nupay_config` table which stores per-organization API keys. Organizations will use their existing Nupay credentials.

---

## Error Handling

| Error Code | Message | Action |
|------------|---------|--------|
| NP000 | Success | Continue |
| NP001 | Record not found | Retry or alert user |
| NP003 | Validation error | Check required fields |
| NP031 | Authorization failed | Re-authenticate |
| NP034 | Token mismatch | Get new token |
| NP041 | Server error | Retry with backoff |

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/nupay-esign-request/index.ts` | Initiate e-sign |
| `supabase/functions/nupay-esign-status/index.ts` | Check status |
| `supabase/functions/nupay-esign-webhook/index.ts` | Handle callbacks |
| `src/components/LOS/Sanction/ESignDocumentButton.tsx` | UI button |
| `src/components/LOS/Sanction/ESignDocumentDialog.tsx` | Confirmation dialog |
| `src/components/LOS/Sanction/ESignStatusBadge.tsx` | Status display |
| `src/hooks/useESignDocument.ts` | React Query hook |

## Files to Modify

| File | Change |
|------|--------|
| Database migration | Add Nupay columns to `document_esign_requests` |
| `DisbursementDashboard.tsx` | Add E-Sign buttons |
| `send-sanction-documents/index.ts` | Optional auto E-Sign trigger |

---

## Testing Strategy

1. **UAT Environment First**: Use Nupay UAT endpoint (`nupaybiz.com/uat/...`)
2. **Test Document Flow**:
   - Generate a test sanction letter
   - Initiate E-Sign with test mobile/email
   - Complete signing via Nupay's test flow
   - Verify status update and document storage
3. **Error Scenarios**: Test invalid credentials, expired tokens, network failures

---

## Security Considerations

- Store API keys in `nupay_config` table (encrypted at rest)
- Validate signer phone/email before sending
- Rate limit E-Sign requests per application
- Audit log all E-Sign activities in `document_esign_requests.audit_log`
- Verify webhook signatures before processing

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Database Schema | 1 hour |
| Edge Functions | 4 hours |
| PDF Generation | 2 hours |
| Frontend Components | 3 hours |
| Integration & Testing | 2 hours |
| **Total** | **~12 hours** |
