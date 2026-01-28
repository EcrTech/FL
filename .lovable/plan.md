

# Send Equifax API Request as JSON (Not XML)

## Problem

The Equifax credit report edge function currently tries multiple XML formats first, and only uses JSON as a last resort. The user wants to send the request in JSON format directly.

## Solution

Modify the request strategy to send JSON as the primary (and only) format, removing the XML-first approach.

## Technical Changes

### File: `supabase/functions/equifax-credit-report/index.ts`

**Lines 1117-1175 - Replace multi-format strategy with JSON-only:**

Current code tries formats in this order:
1. XML with Accept All
2. Plain application/xml
3. XML with empty SOAPAction
4. SOAP/XML
5. SOAP with action
6. JSON (last resort)

New code will:
- Send request as JSON directly
- Use `application/json` content type
- Remove all XML format attempts

**Changes:**

| Section | Current | New |
|---------|---------|-----|
| Format attempts | 6 formats (5 XML + 1 JSON) | 1 format (JSON only) |
| Content-Type | `application/xml` first | `application/json` |
| Accept header | Various XML types | `application/json` |
| Request body | XML string | JSON string |
| Storage metadata | `request_format: "xml"` | `request_format: "json"` |

**Code Changes (Lines 1117-1228):**

Replace the multi-format loop with a single JSON request:

```typescript
try {
  // Send request as JSON
  console.log(`[EQUIFAX-DEBUG] ========== SENDING JSON REQUEST ==========`);
  
  // Log redacted request
  const redactedBody = JSON.stringify(equifaxRequest)
    .replace(/"Password":"[^"]*"/g, '"Password":"***REDACTED***"')
    .replace(/"SecurityCode":"[^"]*"/g, '"SecurityCode":"***REDACTED***"');
  
  console.log(`[EQUIFAX-DEBUG] Content-Type: application/json`);
  console.log(`[EQUIFAX-DEBUG] Request body (redacted):`, redactedBody);
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(equifaxRequest),
  });

  console.log(`[EQUIFAX-DEBUG] Response Status:`, response.status, response.statusText);
  
  const responseText = await response.text();
  console.log(`[EQUIFAX-DEBUG] Response length:`, responseText.length);
  console.log(`[EQUIFAX-DEBUG] Response (first 2000 chars):`, responseText.substring(0, 2000));
  
  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${responseText.substring(0, 500)}`);
  }
  
  // Parse JSON response
  rawApiResponse = JSON.parse(responseText);
  // ... rest of response handling
}
```

**Line 1343 - Update request format metadata:**

```typescript
request_format: "json",  // Changed from "xml"
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Replace XML format strategy with JSON-only request |

## Expected Result

| Before | After |
|--------|-------|
| Request sent as XML | Request sent as JSON |
| Content-Type: `application/xml` | Content-Type: `application/json` |
| Tries 6 different formats | Single JSON request |

## Additional Cleanup

The following XML helper functions will become unused and can be removed:
- `jsonToXmlPlain()` (lines 208-287)
- `jsonToSoapXml()` (lines 292-373)
- `escapeXml()` (lines 195-203)
- `xmlToJson()` (lines 438-597) - Keep for parsing XML responses if Equifax returns XML
- Various XML extraction functions (keep as fallback)

