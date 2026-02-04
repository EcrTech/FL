
# Plan: Switch All Nupay E-Sign Components to Production

## Problem

The E-Sign request is failing because the components are still defaulting to "uat" environment, but only the production configuration is active in the database.

## Root Cause Analysis

The E-Sign components have hardcoded defaults:
- `ESignDocumentButton.tsx` (line 38): `environment = "uat"`
- `ESignDocumentDialog.tsx` (line 52): `environment = "uat"`

Even though `CombinedLoanPackCard.tsx` was updated to pass `environment="production"`, this approach is fragile - every component that uses E-Sign would need to know the correct environment.

## Solution: Auto-Detect Active Environment

Instead of hardcoding, we should fetch the active Nupay configuration and use its environment automatically (like `CreateMandateDialog.tsx` already does).

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/LOS/Sanction/ESignDocumentDialog.tsx` | Fetch active Nupay config and use its environment |
| `src/components/LOS/Sanction/ESignDocumentButton.tsx` | Change default from "uat" to "production" as fallback |
| `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx` | Remove hardcoded environment prop (will be auto-detected) |

---

## Implementation Details

### 1. Update ESignDocumentDialog.tsx

Add a query to fetch the active Nupay config and use its environment:

```typescript
// Add query to fetch active config
const { data: nupayConfig } = useQuery({
  queryKey: ["nupay-config-active", orgId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("nupay_config")
      .select("environment")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .single();
    if (error) return null;
    return data;
  },
  enabled: !!orgId && open,
});

// Use detected environment or fallback to production
const activeEnvironment = nupayConfig?.environment || environment || "production";
```

Then use `activeEnvironment` when calling the E-Sign mutation.

### 2. Update ESignDocumentButton.tsx

Change the default value from "uat" to "production":

```typescript
// Line 38: Change from
environment = "uat",
// To
environment = "production",
```

### 3. Clean Up CombinedLoanPackCard.tsx

Remove the explicit `environment="production"` prop since it will now be auto-detected:

```tsx
// Remove this line:
environment="production"
// The dialog will auto-detect the active environment
```

---

## Why This Approach?

1. **Centralized logic**: Environment detection happens in the dialog component, not scattered across all callers
2. **Future-proof**: If a user switches back to UAT for testing, it will automatically work
3. **Consistent with eMandate**: Uses the same pattern as `CreateMandateDialog.tsx` which already works correctly
4. **Fallback to production**: If no config is found, defaults to production (safer for live operations)

---

## Technical Summary

| Component | Before | After |
|-----------|--------|-------|
| ESignDocumentButton | Default: "uat" | Default: "production" |
| ESignDocumentDialog | Uses passed prop (default "uat") | Auto-detects from DB, fallback to "production" |
| CombinedLoanPackCard | Passes "production" explicitly | Relies on auto-detection |
