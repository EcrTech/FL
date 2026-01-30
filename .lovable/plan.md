
# Update Email Template and E-Sign Status Flow Overview

## Summary
Update the email template to match your approved WhatsApp template's congratulatory tone, then test the complete E-Sign notification flow.

## 1. Email Template Update

### Current Email Content (lines 40-78 in `send-esign-notifications/index.ts`)
```
Subject: E-Sign Request: {Document Label}
Body: "Dear {Name}, You have received a document for electronic signature..."
```

### New Email Content (matching WhatsApp tone)
```
Subject: Congratulations! Please Sign Your {Document Label}
Body: "Dear {Name}, Congratulations on your loan approval! Here is the link 
       for your electronic signature. Please click the button below to review 
       and sign the document. This link is valid for 72 hours."
```

### File to Modify
`supabase/functions/send-esign-notifications/index.ts` (lines 40-92)

---

## 2. E-Sign Response Flow (Current Implementation)

### How Signed Status is Received

**Two mechanisms exist:**

1. **Webhook (Automatic)** - `nupay-esign-webhook` Edge Function
   - Nupay sends a POST request when signing is complete
   - Payload includes: `document_id`, `status`, `signer_info`, optionally `signed_document` (base64 PDF)

2. **Manual Status Check (Polling)** - `nupay-esign-status` Edge Function
   - Triggered via the refresh button in the UI
   - Calls Nupay's `/api/SignDocument/documentStatus` endpoint
   - Polls every 30 seconds while status is pending/sent/viewed

### Where Signed Status is Stored

**`document_esign_requests` table** stores:
| Field | Description |
|-------|-------------|
| `status` | pending → sent → viewed → signed |
| `signed_at` | Timestamp when signed |
| `signed_document_path` | Storage path if Nupay returns PDF |
| `audit_log` | JSON array of status changes |
| `esign_response` | Raw Nupay webhook payload |

**`loan_generated_documents` table** is also updated:
| Field | Description |
|-------|-------------|
| `customer_signed` | Set to `true` |
| `signed_at` | Timestamp |
| `status` | Set to `signed` |

### How Status is Displayed in UI

**Component: `ESignDocumentButton.tsx`**
- Uses `useESignRequests(applicationId)` hook to fetch all e-sign requests
- Finds the latest request for each document type
- Renders `ESignStatusBadge` showing: Pending, Sent, Viewed, or Signed
- Shows refresh button to manually trigger status check

**Component: `ESignStatusBadge.tsx`**
- Color-coded badges: Yellow (pending), Blue (sent), Purple (viewed), Green (signed)
- Tooltip shows sent/viewed/signed timestamps

**Locations in UI:**
- Disbursement Dashboard (`DisbursementDashboard.tsx` line 559)
- Displayed next to each document (Sanction Letter, Loan Agreement, Daily Schedule)

---

## 3. Testing the Complete Flow

After deploying the email template update, test by:

1. Go to a sanctioned loan application
2. Navigate to Disbursement tab
3. Click "E-Sign" on Sanction Letter or Loan Agreement
4. Fill in signer details and submit
5. Check:
   - WhatsApp message arrives with "Congratulations on your loan approval..."
   - Email arrives with matching congratulatory content
6. Click the signing link and complete e-sign
7. Return to the app and click the refresh icon
8. Verify status badge changes to "Signed" (green)
