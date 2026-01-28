

# Fix History48Months Array Parsing - Missing Implementation

## Problem Identified

The logs clearly show the error:
```
TypeError: history48Months.substring is not a function
```

The fix for handling the CIR 360 JSON format (where `History48Months` is an **array of objects**) was not applied to the file. The current code at lines 672-685 still treats it as a string:

```typescript
// Current broken code:
const history48Months = acc.History48Months || "";
for (let i = 0; i < history48Months.length && i < 144; i += 3) {
  const status = history48Months.substring(i, i + 3);  // ← CRASHES HERE
  ...
}
```

---

## Solution

Update the account parsing logic to detect whether `History48Months` is an array or string, and handle both formats appropriately.

---

## Technical Implementation

### File: `supabase/functions/equifax-credit-report/index.ts`

**Replace lines 670-703** with:

```typescript
// Parse accounts
const accounts = retailAccountDetails.map((acc: any) => {
  const history48MonthsRaw = acc.History48Months;
  const paymentHistory: any[] = [];
  
  // Handle both formats: array of objects (CIR 360 JSON) or string (legacy)
  if (Array.isArray(history48MonthsRaw)) {
    // CIR 360 JSON format - array of objects like:
    // [{"key":"01-26","PaymentStatus":"000","SuitFiledStatus":"*","AssetClassificationStatus":"*"}, ...]
    history48MonthsRaw.forEach((item: any) => {
      const status = item.PaymentStatus || "*";
      paymentHistory.push({
        month: item.key || "",
        status: status,
        label: PAYMENT_STATUS[status]?.label || status,
        severity: PAYMENT_STATUS[status]?.severity || "current",
      });
    });
  } else if (typeof history48MonthsRaw === "string" && history48MonthsRaw.length > 0) {
    // Legacy string format - each 3 characters represents a month
    for (let i = 0; i < history48MonthsRaw.length && i < 144; i += 3) {
      const status = history48MonthsRaw.substring(i, i + 3);
      const monthIndex = Math.floor(i / 3);
      paymentHistory.push({
        month: monthIndex + 1,
        status: status,
        label: PAYMENT_STATUS[status]?.label || status,
        severity: PAYMENT_STATUS[status]?.severity || "current",
      });
    }
  }

  return {
    institution: acc.Institution || "Unknown",
    accountType: acc.AccountType || "Unknown",
    ownershipType: acc.OwnershipType || "Individual",
    accountNumber: acc.AccountNumber || "",
    status: acc.AccountStatus || "Unknown",
    sanctionAmount: parseFloat(acc.SanctionAmount) || 0,
    currentBalance: parseFloat(acc.Balance || acc.CurrentBalance) || 0,
    pastDueAmount: parseFloat(acc.PastDueAmount || acc.AmountPastDue) || 0,
    emiAmount: parseFloat(acc.InstallmentAmount) || 0,
    dateOpened: acc.DateOpened || "",
    dateClosed: acc.DateClosed || "",
    dateReported: acc.DateReported || "",
    paymentHistory: paymentHistory,
    rawHistory: Array.isArray(history48MonthsRaw) 
      ? JSON.stringify(history48MonthsRaw) 
      : (history48MonthsRaw || ""),
  };
});
```

**Additional fix:** The response also uses `Balance` and `PastDueAmount` (not `CurrentBalance`/`AmountPastDue`), so we need to check both field names.

---

## Expected Result

| Input Format | Before | After |
|--------------|--------|-------|
| `[{key:"01-26", PaymentStatus:"000"}, ...]` | Crash: `substring is not a function` | Properly parsed |
| `"000000030..."` (legacy string) | Works | Still works |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Fix `History48Months` parsing at lines 670-703 to handle array format |

