
# Updated Plan: Combined Loan Documents with E-Sign + Notifications

## Overview

Merge the three sanction stage documents (Sanction Letter, Loan Agreement, Daily Repayment Schedule) into a single "Combined Loan Pack" PDF that can be downloaded, sent for e-signature with automatic WhatsApp and Email notifications, and viewed after signing.

---

## Existing Notification System (Already Implemented)

The e-sign notification delivery is already fully automated:

1. **Trigger**: When `nupay-esign-request` successfully registers a document, it calls `send-esign-notifications`
2. **Channels**: Automatically sends via WhatsApp (Exotel) and Email (Resend) based on signer details
3. **WhatsApp Template**: Uses approved `esign_request` template with 2 variables (Signer Name, Signing URL)
4. **Email Template**: Congratulatory green-themed email with "Sign Document" button

**Only Update Needed**: Add `combined_loan_pack` to the document label mapping for proper email subject/body display.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/LOS/Sanction/templates/CombinedLoanDocuments.tsx` | CREATE | Combined template with all 3 documents |
| `src/components/LOS/Disbursement/DisbursementDashboard.tsx` | MODIFY | Add Combined Loan Pack card with actions |
| `supabase/functions/nupay-esign-request/index.ts` | MODIFY | Generate proper combined PDF for e-sign |
| `supabase/functions/send-esign-notifications/index.ts` | MODIFY | Add `combined_loan_pack` label mapping |
| `src/hooks/useESignDocument.ts` | MODIFY | Add combined_loan_pack type |
| `src/components/LOS/Sanction/ESignDocumentDialog.tsx` | MODIFY | Add combined_loan_pack type |
| `src/components/LOS/Sanction/ESignDocumentButton.tsx` | MODIFY | Add combined_loan_pack type |

---

## Technical Implementation Details

### 1. Create Combined Template

**File**: `src/components/LOS/Sanction/templates/CombinedLoanDocuments.tsx`

Renders all three existing document templates in sequence with CSS page breaks:

```tsx
export default function CombinedLoanDocuments(props) {
  return (
    <div>
      <SanctionLetterDocument {...props} />
      <div className="break-before-page print:break-before-page" />
      <LoanAgreementDocument {...props} />
      <div className="break-before-page print:break-before-page" />
      <DailyRepaymentScheduleDocument {...props} />
    </div>
  );
}
```

### 2. Update Dashboard UI

**File**: `src/components/LOS/Disbursement/DisbursementDashboard.tsx`

Add a "Combined Loan Pack" card with:
- Generate All button (creates record in `loan_generated_documents`)
- Download All button (html2pdf with pagebreak options)
- E-Sign All button (reuses `ESignDocumentButton` with combined type)
- View Signed Document button (appears after e-signature complete)

The card will be prominently displayed above the individual document cards.

### 3. Update E-Sign Request Edge Function

**File**: `supabase/functions/nupay-esign-request/index.ts`

Add `combined_loan_pack` to document type handling:
- Generate multi-page PDF with all three document sections
- Sanction Letter pages
- Loan Agreement pages  
- Daily Repayment Schedule pages
- Single signature placeholder at the end

### 4. Update Notification Label (Key Change)

**File**: `supabase/functions/send-esign-notifications/index.ts`

Update the document label mapping at line 34-35:

```typescript
// Current:
const documentLabel = documentType === "sanction_letter" ? "Sanction Letter" :
  documentType === "loan_agreement" ? "Loan Agreement" : "Daily Repayment Schedule";

// Updated:
const documentLabel = documentType === "sanction_letter" ? "Sanction Letter" :
  documentType === "loan_agreement" ? "Loan Agreement" :
  documentType === "combined_loan_pack" ? "Combined Loan Pack" : "Daily Repayment Schedule";
```

This ensures:
- Email subject shows: "Congratulations! Please Sign Your Combined Loan Pack"
- Email body shows: "Combined Loan Pack - Ready for your signature"

### 5. Update Type Definitions

**Files**: `useESignDocument.ts`, `ESignDocumentDialog.tsx`, `ESignDocumentButton.tsx`

Add `combined_loan_pack` to document type unions:

```typescript
documentType: "sanction_letter" | "loan_agreement" | "daily_schedule" | "combined_loan_pack";
```

---

## Complete E-Sign Flow with Notifications

```text
1. User clicks "Generate All" 
   → Creates record in loan_generated_documents with type "combined_loan_pack"
   
2. User clicks "E-Sign All"
   → Opens ESignDocumentDialog with document_type = "combined_loan_pack"
   
3. Dialog calls nupay-esign-request edge function
   → Generates combined PDF (all 3 documents)
   → Uploads to Nupay
   → Returns signing URL
   
4. nupay-esign-request calls send-esign-notifications
   → Sends WhatsApp via Exotel (esign_request template)
   → Sends Email via Resend (green congratulatory template)
   → Both messages include signing link
   
5. Borrower receives link via WhatsApp + Email
   → Opens link
   → Signs document via Aadhaar OTP
   
6. Nupay returns signed PDF (via webhook or polling)
   → Stores in loan-documents bucket: signed/{app_id}/combined_loan_pack_signed_{timestamp}.pdf
   → Updates loan_generated_documents.signed_document_path
   → Updates loan_generated_documents.customer_signed = true
   
7. UI shows "View Signed Document" button
   → Opens signed combined PDF in new tab
```

---

## UI Wireframe

```text
┌─────────────────────────────────────────────────────────────┐
│ 📄 Loan Documents                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📦 Combined Loan Pack                    [✓ Signed] │   │
│  │ All documents in one file for easy signing          │   │
│  │                                                      │   │
│  │ [Generate All] [Download] [E-Sign] [View Signed]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 📄 Sanction  │ │ 📄 Agreement │ │ 📄 Repayment │        │
│  │ [Generated]  │ │ [Generated]  │ │ [Generated]  │        │
│  │ [📄][🖨️][⬇️] │ │ [📄][🖨️][⬇️] │ │ [📄][🖨️][⬇️] │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary of Notification Handling

| Component | Status | Notes |
|-----------|--------|-------|
| WhatsApp delivery (Exotel) | Already implemented | Uses `esign_request` template |
| Email delivery (Resend) | Already implemented | Green congratulatory theme |
| Auto-trigger on e-sign | Already implemented | Called from nupay-esign-request |
| Combined Loan Pack label | Needs update | Add mapping in send-esign-notifications |
| Status tracking | Already implemented | Webhook + polling update DB |
| Signed PDF storage | Already implemented | Stores in loan-documents bucket |
| View Signed button | Already implemented | Opens signed PDF URL |
