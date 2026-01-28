

# Add Timeout Safety & Chaining Logic to Prevent Edge Function Timeouts

## Problem Summary

The edge function has **no timeout protection** or performance optimization, causing it to timeout when processing large Equifax responses (88KB+ with 14 accounts × 48 months history each).

---

## Solution: Multi-Layer Timeout Protection

### 1. Add Fetch Timeout (Prevents hanging on slow API)

```typescript
// Create AbortController with 25-second timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25000);

try {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {...},
    body: JSON.stringify(equifaxRequest),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error("Equifax API request timed out after 25 seconds");
  }
  throw error;
}
```

### 2. Limit Account Processing (Prevents parsing timeout)

```typescript
// Only process first 15 accounts to ensure fast parsing
const maxAccounts = 15;
const accountsToProcess = retailAccountDetails.slice(0, maxAccounts);
const accounts = accountsToProcess.map((acc: any) => {...});
```

### 3. Limit Payment History to 24 Months

```typescript
if (Array.isArray(history48MonthsRaw)) {
  // Only keep last 24 months to reduce processing
  const recentHistory = history48MonthsRaw.slice(0, 24);
  recentHistory.forEach((item: any) => {...});
}
```

### 4. Simplify rawHistory Storage

```typescript
// Don't stringify large arrays - just store summary
rawHistory: Array.isArray(history48MonthsRaw) 
  ? `array:${history48MonthsRaw.length} months` 
  : (history48MonthsRaw || ""),
```

### 5. Truncate Raw API Response for Storage

```typescript
// Store truncated response to prevent slow DB insert
raw_api_response: rawApiResponse 
  ? { 
      summary: "Full response available in parsed data",
      hitCode: rawApiResponse?.InquiryResponseHeader?.HitCode,
      accountCount: retailAccountDetails.length,
    }
  : null,
```

### 6. Reduce Logging Overhead

Remove or minimize these heavy log statements:
- `console.log("[EQUIFAX-DEBUG] Response (first 2000 chars):", ...)`
- `console.log("[EQUIFAX-PARSE] Score extraction - scoreDetails:", JSON.stringify(...))`

---

## Technical Implementation

### File: `supabase/functions/equifax-credit-report/index.ts`

**Changes:**

| Location | Change |
|----------|--------|
| Lines 1227-1246 | Add `AbortController` with 25-second timeout to fetch |
| Lines 671-720 | Limit to 15 accounts, 24 months history, simplify rawHistory |
| Lines 1396 | Truncate `raw_api_response` before storage |
| Lines 763-766, 1251-1252 | Remove heavy JSON.stringify logging |

---

## Expected Performance Impact

| Metric | Before | After |
|--------|--------|-------|
| Fetch timeout | None (hangs forever) | 25 seconds max |
| Accounts processed | All (14+) | Max 15 |
| History per account | 48 months | 24 months |
| Raw response storage | 88KB JSON | ~500 bytes summary |
| Total processing time | 30+ seconds (timeout) | <5 seconds |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Add timeout, limit processing, reduce logging |

