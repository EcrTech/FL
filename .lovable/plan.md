

## Fix: Add `verification_type: "pennyless"` to Bank Verification API Request

### Problem
The VerifiedU Bank Verification API is returning a 400 error:
```json
{"errors":{"verification_type":["Verification Type is required"]}}
```

The request body is missing the required `verification_type` field.

### Solution
Add `verification_type: "pennyless"` to the request body in the edge function. This is a "pennyless" verification (validates account without depositing money).

---

### File to Modify

| File | Change |
|------|--------|
| `supabase/functions/verifiedu-bank-verify/index.ts` | Add `verification_type` to request body |

---

### Code Change

**Location:** Lines 82-85

**Current code:**
```javascript
body: JSON.stringify({
  account_number: accountNumber,
  account_ifsc: ifscCode,
}),
```

**Updated code:**
```javascript
body: JSON.stringify({
  verification_type: "pennyless",
  account_number: accountNumber,
  account_ifsc: ifscCode,
}),
```

---

### Expected Result
1. Edge function sends complete request with `verification_type: "pennyless"`
2. VerifiedU API accepts the request and validates the bank account
3. API returns account holder name and validation status
4. Bank verification succeeds and updates `loan_applicants.bank_verified = true`
5. Green "Verified" badge appears in Bank Details section

