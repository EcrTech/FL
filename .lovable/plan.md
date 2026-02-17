

# Fix UTR Extraction from Image-Based Transaction Slips

## Problem

When transaction slip images (JPEG/PNG screenshots of bank e-receipts) are uploaded during disbursement completion, the system fails to extract the UTR number. PDF uploads work fine -- all 4 PDF-based disbursement proofs in the database have UTR numbers extracted. The one image upload (JPEG) has `utr_number: null` despite parsing completing.

## Root Causes

**1. Prompt inconsistency for image parsing**
The PDF parsing path appends a critical instruction to force clean JSON output (line 411):
```
"\n\nCRITICAL: Respond with ONLY the raw JSON object. No text before or after..."
```
But the **image parsing path** (line 514) sends just the base prompt without this instruction, leading to unreliable JSON parsing.

**2. Prompt doesn't account for bank-specific terminology**
Bank receipts label the reference as "Transaction ID" (e.g., `IDFB604565324016` in the uploaded IDFC First Bank slip), but the extraction prompt only asks for "UTR (Unique Transaction Reference) number or transaction reference ID". The AI sometimes fails to map "Transaction ID" to "utr_number" for image inputs.

## Solution

### File: `supabase/functions/parse-loan-document/index.ts`

**Change 1: Add missing JSON instruction to image parsing path**
On line 514, append the same critical JSON instruction that the PDF path uses:
```
text: prompt + "\n\nCRITICAL: Respond with ONLY the raw JSON object..."
```

**Change 2: Enhance the disbursement_proof prompt**
Update the `disbursement_proof` and `utr_proof` prompts (lines 162-180) to explicitly list common bank-specific field names:
- "Transaction ID", "Reference Number", "NEFT Reference", "RTGS Reference", "IMPS Reference", "CMS Reference" should all be mapped to `utr_number`
- Add instruction: "Look for ANY transaction reference number, including fields labeled Transaction ID, Ref No, Reference Number, CMS Ref, etc."

**Change 3: Add retry with enhanced prompt for null UTR**
After parsing the image response, if `utr_number` is null, add a targeted retry with a simpler, more direct prompt specifically asking for the transaction reference number visible in the image.

### Expected Result
- Image-based transaction slips (bank screenshots, e-receipts) will have UTR numbers reliably extracted
- The system will recognize bank-specific terminology like "Transaction ID" as the UTR
- PDF parsing continues to work as before

### Technical Details

Only one file is modified: `supabase/functions/parse-loan-document/index.ts`

1. Lines 162-170 and 172-180: Update both `disbursement_proof` and `utr_proof` prompt text to be more explicit about field name variations
2. Line 514: Add the JSON-only instruction suffix to image parsing
3. After line 138 in `ProofUploadDialog.tsx`: No changes needed -- the frontend already handles null UTR gracefully

The edge function will be automatically redeployed after the change.
