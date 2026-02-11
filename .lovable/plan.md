
## Fix Aadhaar Back Parsing and Bank Verification

### Issue 1: Aadhaar Back Not Parsing Properly

**Root Cause**: The edge function has a prompt key `aadhaar_card` but the document type stored in the database is `aadhaar_back` (and `aadhaar_front`). Since there's no matching prompt for `aadhaar_back`, it falls back to a generic "Extract all relevant information" prompt, which returns unpredictable field structures.

The frontend then tries to read `aadhaarBackData?.aadhaar_card_details?.address?.english` -- a deeply nested path that doesn't exist in the actual OCR output. The real data has `address_english` as a flat string.

**Fix**:
1. Add dedicated `aadhaar_front` and `aadhaar_back` prompt keys in `DOCUMENT_PROMPTS` in the edge function:
   - `aadhaar_front`: Extract aadhaar_number, name, dob, gender
   - `aadhaar_back`: Extract aadhaar_number, address (as a single flat string), VID
2. Update the address merging logic in **3 files** to handle the actual flat OCR data structure (`address_english` or `address`) instead of expecting a nested `aadhaar_card_details.address.english` path:
   - `src/pages/LOS/ApplicationDetail.tsx`
   - `src/pages/LOS/SanctionDetail.tsx`
   - `src/components/LOS/DocumentDataVerification.tsx`

### Issue 2: Bank Account Verification Failing

**Root Cause**: The OCR-extracted IFSC code `DBSSOINO811` is incorrect. DBS Bank IFSC codes follow the format `DBSS0IN0XXX` (with zeros, not letter O). The VerifiedU API correctly rejects it as "Invalid account ifsc provided."

**Fix**:
1. Add IFSC validation/sanitization in the bank verification edge function (`verifiedu-bank-verify`) before sending to the API:
   - Standard IFSC format: 4 letters + 0 + 6 alphanumeric characters (the 5th character is always zero)
   - Auto-correct common OCR mistakes: replace letter 'O' with digit '0' at position 5 (which must always be '0' per RBI rules)
2. Also add IFSC format correction in the bank statement parsing prompt to instruct the AI to output valid IFSC codes (5th char must be '0').

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/parse-loan-document/index.ts` | Add `aadhaar_front` and `aadhaar_back` prompt keys; update bank statement prompt to enforce IFSC format |
| `supabase/functions/verifiedu-bank-verify/index.ts` | Add IFSC sanitization (replace 'O' with '0' at position 5) |
| `src/pages/LOS/ApplicationDetail.tsx` | Fix aadhaar back address merging to handle flat `address_english` / `address` fields |
| `src/pages/LOS/SanctionDetail.tsx` | Same address merging fix |
| `src/components/LOS/DocumentDataVerification.tsx` | Same address merging fix |
