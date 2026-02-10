

## Document Fraud Detection AI Tool

### Overview

A new edge function (`detect-document-fraud`) will analyze all uploaded documents for a loan application using Gemini's vision capabilities to detect signs of tampering, forgery, or data inconsistency. Results will be displayed as a "Fraud Check" card within the DocumentUpload component.

---

### How It Works

1. Staff clicks "Fraud Check" button on the Documents section
2. Frontend calls the `detect-document-fraud` edge function with the application ID
3. Edge function fetches all uploaded documents from the `loan-documents` storage bucket
4. Each document image/PDF is sent to Gemini (via Lovable AI gateway) with a fraud-detection prompt
5. Cross-document consistency checks are performed (e.g., name on PAN vs name on salary slip)
6. Results are stored in `loan_verifications` with `verification_type = 'document_fraud_check'`
7. UI displays a risk summary card (Low/Medium/High) with individual findings per document

---

### Edge Function: `detect-document-fraud`

**Input:** `{ applicationId: string }`

**Process:**
- Fetch all `loan_documents` records for the application
- Download each document from `loan-documents` storage bucket
- Send each document image to Gemini (`google/gemini-2.5-flash`) with a prompt asking it to analyze for:
  - Font inconsistencies or overlaid text
  - Pixel artifacts indicating digital alteration
  - Mismatched formatting (e.g., salary slip with different fonts for amount vs header)
  - Unrealistic values (e.g., salary of 99,99,999)
  - Signs of cut-paste or whitespace manipulation
- After individual analysis, do a cross-document check using the already-parsed OCR data:
  - Name consistency across PAN, Aadhaar, salary slips
  - PAN number consistency across PAN card and Form 16
  - Employer name consistency across salary slips and offer letter
  - Date of birth consistency across PAN and Aadhaar
- Aggregate findings into a risk score and per-document detail list

**Output:**
```json
{
  "overall_risk": "low" | "medium" | "high",
  "risk_score": 15,
  "documents_analyzed": 8,
  "findings": [
    {
      "document_type": "salary_slip_1",
      "risk_level": "medium",
      "issues": ["Font inconsistency in net salary field", "Company logo appears low-resolution compared to text"]
    }
  ],
  "cross_document_checks": [
    {
      "check": "Name consistency",
      "status": "pass" | "fail" | "warning",
      "detail": "Name matches across PAN, Aadhaar, and salary slips"
    }
  ]
}
```

**Storage:** Upsert into `loan_verifications` with `verification_type = 'document_fraud_check'`

---

### Frontend Changes

**DocumentUpload.tsx:**
- Add a "Fraud Check" button next to the existing "Parse All" button
- Show a loading state while analysis runs (it may take 30-60 seconds for multiple documents)
- After completion, render a `FraudCheckResultCard` component below the document table

**New Component: `FraudCheckResultCard.tsx`**
- Shows overall risk badge (green/yellow/red)
- Lists per-document findings in an expandable accordion
- Shows cross-document consistency results
- Displays timestamp of last fraud check

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/detect-document-fraud/index.ts` | Create -- edge function |
| `supabase/config.toml` | Add function entry with `verify_jwt = false` |
| `src/components/LOS/DocumentUpload.tsx` | Add Fraud Check button + result display |
| `src/components/LOS/FraudCheckResultCard.tsx` | Create -- result display component |

---

### Technical Notes

- Uses `LOVABLE_API_KEY` (already configured) to call the Lovable AI gateway
- Model: `google/gemini-2.5-flash` (good balance of vision capability and speed; cheaper than Pro for batch analysis)
- Documents are sent as base64-encoded images to the multimodal API
- PDFs are downloaded and converted; images are sent directly
- Rate limiting: Documents are analyzed sequentially (not in parallel) to avoid hitting Lovable AI rate limits
- The cross-document consistency check reuses existing OCR data from `loan_documents.ocr_data` rather than re-parsing
- No database schema changes needed -- uses existing `loan_verifications` table

