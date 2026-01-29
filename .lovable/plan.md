
# Fix E-Sign PDF Generation - Rupee Symbol Encoding Error

## Problem Identified

The E-Sign functionality is failing because the PDF generation library (`pdf-lib`) cannot encode the Indian Rupee symbol (₹) when using standard fonts.

### Error from Edge Function Logs
```
Error: WinAnsi cannot encode "₹" (0x20b9)
    at r.encodeUnicodeCodePoint (standard-fonts.mjs)
    at createPdfFromDocument (index.ts:108)
```

### Root Cause
Standard PDF fonts (Helvetica, Times-Roman, Courier) only support **WinAnsi encoding**, which is limited to ASCII and Western European characters. The Rupee symbol (₹) is a Unicode character (U+20B9) that is not included in this encoding.

The problematic line is:
```typescript
`Loan Amount: ₹${sanction?.sanctioned_amount?.toLocaleString("en-IN") || "N/A"}`,
```

---

## Solution

Replace the Rupee symbol (₹) with a compatible alternative like `Rs.` or `INR` in the PDF text content.

---

## Technical Implementation

### File: `supabase/functions/nupay-esign-request/index.ts`

**Change in createPdfFromDocument function (lines 143-161):**

Replace all instances of the ₹ symbol with `Rs.`:

```typescript
const lines = [
  `Application Number: ${appData.application_number || "N/A"}`,
  `Date: ${new Date().toLocaleDateString("en-IN")}`,
  "",
  `Loan Amount: Rs. ${sanction?.sanctioned_amount?.toLocaleString("en-IN") || "N/A"}`,
  `Interest Rate: ${sanction?.interest_rate || "N/A"}% p.a.`,
  `Tenure: ${sanction?.tenure_months || "N/A"} months`,
  "",
  "This document is digitally generated and requires Aadhaar-based e-signature",
  "for legal validity.",
  "",
  "",
  "",
  "Signature: ___________________________",
  "",
  "",
  "(This space is reserved for digital signature)",
];
```

---

## Alternative: Embed Custom Font (More Complex)

For proper ₹ symbol support, we would need to:
1. Embed a custom font (like Noto Sans) that includes the Rupee character
2. Load the font bytes in the edge function
3. Use `pdfDoc.embedFont(fontBytes)` instead of `StandardFonts.Helvetica`

This approach is more complex and increases function size/latency, so using `Rs.` is the recommended quick fix.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/nupay-esign-request/index.ts` | Replace ₹ with Rs. in PDF text content |

---

## Expected Result

After this fix:
- PDF generation will succeed
- E-Sign request will be sent to Nupay API
- Signer URL will be returned to the user

| Before | After |
|--------|-------|
| ₹12,500 (fails) | Rs. 12,500 (works) |
