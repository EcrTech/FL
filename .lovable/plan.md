

# Change DOB Format to YYYY-MM-DD for Equifax API

## Problem

The current `formatDate` function converts DOB from `YYYY-MM-DD` to `DD-MM-YYYY`. Equifax API requires the DOB in `YYYY-MM-DD` format.

## Solution

Modify the `formatDate` function to return the date as-is (since it's already stored in `YYYY-MM-DD` format in the database).

## Technical Changes

### File: `supabase/functions/equifax-credit-report/index.ts`

**Lines 188-196 - Update formatDate function:**

Current code:
```typescript
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  // Convert YYYY-MM-DD to DD-MM-YYYY
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}
```

New code:
```typescript
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  // Return date as YYYY-MM-DD (already in correct format from database)
  // Equifax API requires YYYY-MM-DD format
  return dateStr;
}
```

## Result

| Before | After |
|--------|-------|
| DOB sent as `02-08-2006` | DOB sent as `2006-08-02` |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Update `formatDate` to keep YYYY-MM-DD format |

