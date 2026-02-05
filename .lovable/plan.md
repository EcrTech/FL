
# Fix NACH Status Check Error

## Problem

The "Check Status" button for eMandate/NACH is failing with error:
```
"org_id and environment are required"
```

The `nupay-get-status` edge function requires an `environment` parameter ("uat" or "production"), but the frontend is not sending it.

## Current Request Payload (Missing `environment`)
```json
{
  "org_id": "UUID",
  "mandate_id": "UUID", 
  "nupay_id": "NUPAY-REF-ID"
}
```

## Required Request Payload
```json
{
  "org_id": "UUID",
  "environment": "uat",  // <-- MISSING
  "mandate_id": "UUID",
  "nupay_id": "NUPAY-REF-ID"
}
```

## Solution

Update `EMandateSection.tsx` to fetch the active Nupay configuration and include the `environment` in the status check call.

## Implementation

### File: `src/components/LOS/Disbursement/EMandateSection.tsx`

1. **Add a query to fetch the active Nupay config** (similar to `CreateMandateDialog`):

```typescript
// Add after the mandate query (around line 68)
const { data: nupayConfig } = useQuery({
  queryKey: ["nupay-config", orgId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("nupay_config")
      .select("environment")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .maybeSingle();
    
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching Nupay config:", error);
    }
    return data;
  },
  enabled: !!orgId,
});
```

2. **Update `handleCheckStatus` to include the environment** (lines 78-84):

```typescript
const response = await supabase.functions.invoke("nupay-get-status", {
  body: {
    org_id: orgId,
    environment: nupayConfig?.environment || "uat",  // Add this
    mandate_id: mandateData.id,
    nupay_id: mandateData.nupay_id,
  },
});
```

3. **Optionally disable the Check Status button if config is missing**:

```typescript
disabled={isCheckingStatus || !nupayConfig}
```

## Changes Summary

| Location | Change |
|----------|--------|
| Line ~68 | Add `useQuery` to fetch `nupay_config.environment` |
| Line 80 | Add `environment: nupayConfig?.environment \|\| "uat"` to request body |
| Line 239 (optional) | Disable button if `!nupayConfig` |

## Why This Fixes It

The edge function uses `environment` to:
1. Call `nupay-authenticate` with the correct environment
2. Fetch the matching `nupay_config` row (UAT vs Production API endpoints)
3. Make API calls to the correct Nupay server

Without `environment`, the function immediately returns a 400 error.
