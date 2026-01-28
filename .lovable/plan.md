
# Fix Bank Name Display in Credit Report

## Problem Identified

The credit report is showing **"BANK"** instead of the actual bank name (like "HDFC Bank", "ICICI Bank", etc.) because the edge function is looking for the wrong field in the Equifax CIR 360 JSON response.

### Current Code
```typescript
institution: acc.Institution || "Unknown",
```

### Root Cause
The Equifax CIR 360 JSON response uses `SubscriberName` (not `Institution`) for the bank/lender name. The field `Institution` likely contains a generic account type code like "BANK".

---

## Solution

Update the account parsing logic to check multiple possible field names for the institution/subscriber name:

### Field Names to Check (in priority order)
1. `SubscriberName` - Primary field in CIR 360 JSON
2. `InstitutionName` - Alternative field name  
3. `ReportingMemberShortName` - Used in some formats
4. `MemberShortName` - Alternate member name
5. `Institution` - Fallback (current)

---

## Technical Implementation

### File: `supabase/functions/equifax-credit-report/index.ts`

**Change in account parsing (around line 691-725):**

```typescript
const accounts = accountsToProcess.map((acc: any) => {
  // Debug: Log first account's keys to identify correct field name
  if (accountsToProcess.indexOf(acc) === 0) {
    console.log("[EQUIFAX-PARSE] First account keys:", Object.keys(acc).join(", "));
    console.log("[EQUIFAX-PARSE] Potential institution fields:", {
      SubscriberName: acc.SubscriberName,
      InstitutionName: acc.InstitutionName,
      Institution: acc.Institution,
      ReportingMemberShortName: acc.ReportingMemberShortName,
      MemberShortName: acc.MemberShortName,
    });
  }
  
  // ... payment history parsing ...
  
  return {
    // Check multiple possible field names for bank/institution name
    institution: acc.SubscriberName 
      || acc.InstitutionName 
      || acc.ReportingMemberShortName 
      || acc.MemberShortName 
      || acc.Institution 
      || "Unknown",
    // ... rest of fields ...
  };
});
```

---

## Expected Result

| Before | After |
|--------|-------|
| "BANK" displayed for all accounts | Actual bank name (e.g., "HDFC Bank", "ICICI Bank") |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Add fallback chain for institution name field, add debug logging |

---

## Benefits

1. **Correct display** - Users will see actual bank names
2. **Debug logging** - First account's keys will be logged to help identify correct field names
3. **Robust fallback** - Multiple field names checked to handle different response formats
