
# Remove Mock Data Fallback - Show Error on API Failure

## Current Behavior

When the Equifax API call fails, the edge function:
1. Catches the error
2. Falls back to mock/simulated data
3. Returns `success: true` with mock data
4. Frontend shows the mock data as if it were real

## Desired Behavior

When the Equifax API call fails:
1. Return `success: false` with error message
2. Frontend catches the error and shows toast: "Failed to fetch credit report"
3. No mock data is used at all

## Technical Changes

### File: `supabase/functions/equifax-credit-report/index.ts`

**Lines 1278-1292 - Replace mock fallback with error re-throw:**

```typescript
} catch (apiError: any) {
  console.error("[EQUIFAX-DEBUG] ========== API CALL FAILED ==========");
  console.error("[EQUIFAX-DEBUG] Error type:", apiError.constructor.name);
  console.error("[EQUIFAX-DEBUG] Error message:", apiError.message);
  console.error("[EQUIFAX-DEBUG] Error stack:", apiError.stack);
  
  // Re-throw the error - no fallback to mock data
  // This will be caught by the outer catch block and return success: false
  throw new Error(`Failed to fetch credit report: ${apiError.message}`);
}
```

This change:
- Removes `mockReason`, `usedMockData = true`, and `generateMockResponse()` call
- Re-throws the error so it propagates to the outer catch block (lines 1427-1432)
- Outer catch already returns `{ success: false, error: error.message }`
- Frontend already handles `success: false` by showing "Failed to fetch credit report" toast

## Result

| Scenario | Before | After |
|----------|--------|-------|
| API returns error | Shows simulated data | Shows error toast: "Failed to fetch credit report" |
| Network failure | Shows simulated data | Shows error toast: "Failed to fetch credit report" |
| Credentials missing | Shows simulated data | Shows error toast: "Failed to fetch credit report" |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Remove mock fallback, re-throw API errors |
