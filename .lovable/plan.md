
## Fix Disbursals Page to Show Cases Ready for Disbursal

### Problem
The Disbursals page shows "No disbursals found" because the code checks if `sanction_letter` AND `loan_agreement` are individually signed (`customer_signed = true`). However, in your actual workflow, the customer signs the **combined_loan_pack** document, not the individual documents. So the signing check never passes.

For Anupam Roy's case:
- Stage is correctly `disbursement_pending`
- eMandate is `accepted` (signed)
- `combined_loan_pack` is signed -- but `sanction_letter` and `loan_agreement` individually are not
- Result: the case is filtered out and never shown

### Fix

**File: `src/pages/LOS/Disbursals.tsx` (lines 103-113)**

Update the document signing check to accept the `combined_loan_pack` being signed as sufficient (since that's the actual workflow), while still accepting individual signatures as a fallback:

```typescript
// Current (broken):
const sanctionSigned = docs?.find(d => d.document_type === "sanction_letter")?.customer_signed;
const agreementSigned = docs?.find(d => d.document_type === "loan_agreement")?.customer_signed;
if (sanctionSigned && agreementSigned && !existingDisbursement) {

// Fixed:
const combinedSigned = docs?.find(d => d.document_type === "combined_loan_pack")?.customer_signed;
const sanctionSigned = docs?.find(d => d.document_type === "sanction_letter")?.customer_signed;
const agreementSigned = docs?.find(d => d.document_type === "loan_agreement")?.customer_signed;
const documentsReady = combinedSigned || (sanctionSigned && agreementSigned);
if (documentsReady && !existingDisbursement) {
```

This means a case is ready for disbursal if either:
1. The combined loan pack is signed, OR
2. Both individual documents (sanction letter + loan agreement) are signed

### Summary
A single condition change in `Disbursals.tsx`. No database changes needed.
