
# Plan: Test Equifax API Integration with Complete Request/Response Logging

## Overview
Add comprehensive debug logging to the Equifax credit report edge function to capture the complete raw request and response payloads. This will help diagnose whether the API is being called correctly and what responses are being received.

## Current Situation
- All 6 Equifax secrets are configured: `EQUIFAX_API_URL`, `EQUIFAX_CUSTOMER_ID`, `EQUIFAX_USER_ID`, `EQUIFAX_PASSWORD`, `EQUIFAX_MEMBER_NUMBER`, `EQUIFAX_SECURITY_CODE`
- The function falls back to mock data if any of the 4 core credentials are missing/empty
- No edge function logs are currently available, suggesting either no recent calls or logging is insufficient
- The function currently only stores a summary in `loan_verifications`, not the full raw request/response

## Implementation Steps

### Step 1: Add Detailed Debug Logging
Enhance the edge function to log:
- Credential availability check (which credentials are present/missing without exposing values)
- Complete request payload being sent to Equifax (with PII)
- Raw API response from Equifax
- Any errors encountered during the API call

### Step 2: Store Raw Request/Response in Database
Update the `loan_verifications` record to include:
- Full `equifaxRequest` payload in `request_data`
- Complete raw API response in `response_data.raw_response`
- Debug flags indicating if mock data was used and why

### Step 3: Add Credential Validation Logging
Log which specific credentials are missing or empty to quickly identify configuration issues:
```text
[EQUIFAX-DEBUG] Credentials check:
- EQUIFAX_CUSTOMER_ID: configured ✓
- EQUIFAX_USER_ID: missing ✗
- EQUIFAX_PASSWORD: configured ✓
- EQUIFAX_API_URL: configured ✓
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Add comprehensive debug logging for credentials, request, and response |

## Technical Details

### Logging Enhancements
Add the following logging points:

1. **Credential Check** (lines ~485-496):
```typescript
console.log("[EQUIFAX-DEBUG] Credential check:", {
  hasCustomerId: !!customerId,
  hasUserId: !!userId,
  hasPassword: !!password,
  hasMemberNumber: !!memberNumber,
  hasSecurityCode: !!securityCode,
  hasApiUrl: !!apiUrl,
  apiUrlPrefix: apiUrl ? apiUrl.substring(0, 30) + "..." : "NOT SET"
});
```

2. **Request Logging** (before API call at line ~566):
```typescript
console.log("[EQUIFAX-DEBUG] Request payload:", JSON.stringify({
  ...equifaxRequest,
  RequestHeader: {
    ...equifaxRequest.RequestHeader,
    Password: "***REDACTED***"
  }
}, null, 2));
```

3. **Response Logging** (after API response at line ~581):
```typescript
console.log("[EQUIFAX-DEBUG] Raw response:", JSON.stringify(rawResponse, null, 2));
```

4. **Error Logging** (in catch block at line ~586):
```typescript
console.error("[EQUIFAX-DEBUG] API call failed:", {
  error: apiError.message,
  stack: apiError.stack,
  responseStatus: apiError.response?.status
});
```

### Database Storage Update
Store the complete request and response in `loan_verifications`:

```typescript
request_data: {
  bureau_type: "equifax",
  full_request: {
    ...equifaxRequest,
    RequestHeader: {
      ...equifaxRequest.RequestHeader,
      Password: "***REDACTED***"
    }
  },
  pan_number: applicantData.panNumber,
  request_timestamp: new Date().toISOString(),
},
response_data: {
  // existing fields...
  raw_response: rawResponse, // Complete raw API response
  debug_info: {
    credentials_configured: true,
    api_url_used: apiUrl,
    response_timestamp: new Date().toISOString()
  }
}
```

## Testing After Implementation
After deploying the updated edge function:
1. Navigate to an applicant's profile in the application
2. Trigger a Credit Bureau check via the dialog
3. Check the edge function logs for the debug output
4. Query `loan_verifications` table to see the stored request/response

## Expected Outcomes
- Identify if credentials are missing or have empty values
- Capture the exact API request being sent to Equifax
- See the raw response (or error) from the Equifax API
- Store diagnostic data in the database for post-mortem analysis

## Security Note
The password will be redacted in console logs but stored encrypted in the database. Raw PII will be logged for debugging purposes - this should be disabled in production once the issue is resolved.
