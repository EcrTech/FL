
# Fix Equifax 406 Error - Convert to XML Format

## Problem
The Equifax Production API (`ists.equifax.co.in`) is returning a **406 Not Acceptable** error because it requires XML format for requests and responses, but the current edge function sends JSON.

## Solution Overview
Update the `equifax-credit-report` edge function to:
1. Convert the JSON request body to XML format
2. Send requests with `Content-Type: application/xml` headers
3. Parse XML responses back to JSON for the frontend

## Implementation Steps

### Step 1: Add XML Conversion Utility
Create a function to convert the JSON request object to Equifax's expected XML format:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Current JSON Request                                            │
│  ─────────────────────                                           │
│  {                                                               │
│    "RequestHeader": { "CustomerId": "6065", ... },              │
│    "RequestBody": { "FirstName": "John", ... }                   │
│  }                                                               │
├─────────────────────────────────────────────────────────────────┤
│                          ▼                                       │
│                   XML Conversion                                 │
│                          ▼                                       │
├─────────────────────────────────────────────────────────────────┤
│  Required XML Format                                             │
│  ───────────────────                                             │
│  <?xml version="1.0" encoding="UTF-8"?>                         │
│  <ABOREQUESTINFO>                                                │
│    <RequestHeader>                                               │
│      <CustomerId>6065</CustomerId>                              │
│      <UserId>...</UserId>                                        │
│    </RequestHeader>                                              │
│    <RequestBody>                                                 │
│      <InquiryPurpose>05</InquiryPurpose>                        │
│      ...                                                         │
│    </RequestBody>                                                │
│  </ABOREQUESTINFO>                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Add XML Response Parser
Create a function to parse the XML response from Equifax back into a JSON object that the existing `parseEquifaxResponse` function can process.

### Step 3: Update API Call Headers
Change the fetch call from:
```javascript
headers: {
  "Content-Type": "application/json",
  Accept: "application/json",
}
```
To:
```javascript
headers: {
  "Content-Type": "application/xml",
  Accept: "application/xml",
}
```

### Step 4: Wire Up the Conversion Functions
1. Convert request object to XML before sending
2. Parse XML response to JSON after receiving
3. Keep existing JSON parsing as fallback for testing

## Technical Details

### File to Modify
- `supabase/functions/equifax-credit-report/index.ts`

### New Functions to Add

1. **`jsonToXml()`** - Converts the request object to XML string with proper Equifax structure
2. **`xmlToJson()`** - Parses XML response using regex (Deno doesn't have built-in XML parser)

### XML Request Structure (Equifax CIR 360)
The Equifax API expects this XML envelope:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ABOREQUESTINFO>
  <RequestHeader>
    <CustomerId>...</CustomerId>
    <UserId>...</UserId>
    <Password>...</Password>
    <MemberNumber>...</MemberNumber>
    <SecurityCode>...</SecurityCode>
    <CustRefField>...</CustRefField>
    <ProductCode>PCS</ProductCode>
  </RequestHeader>
  <RequestBody>
    <InquiryPurpose>05</InquiryPurpose>
    <TransactionAmount>0</TransactionAmount>
    <FirstName>...</FirstName>
    <MiddleName>...</MiddleName>
    <LastName>...</LastName>
    <DOB>DD-MM-YYYY</DOB>
    <Gender>1 or 2</Gender>
    <InquiryAddresses>
      <InquiryAddress seq="1">
        <AddressType>H</AddressType>
        <AddressLine1>...</AddressLine1>
        <State>XX</State>
        <Postal>XXXXXX</Postal>
      </InquiryAddress>
    </InquiryAddresses>
    <InquiryPhones>
      <InquiryPhone seq="1">
        <Number>...</Number>
        <PhoneType>M</PhoneType>
      </InquiryPhone>
    </InquiryPhones>
    <IDDetails>
      <IDDetail seq="1">
        <IDType>T</IDType>
        <IDValue>PANXXXXXXXX</IDValue>
        <Source>Inquiry</Source>
      </IDDetail>
    </IDDetails>
    <Score>
      <Type>ERS</Type>
      <Version>4.0</Version>
    </Score>
  </RequestBody>
</ABOREQUESTINFO>
```

### Error Handling
- If XML conversion fails, log error and fall back to mock data
- If XML response parsing fails, try JSON parsing as fallback
- Add detailed logging for debugging XML issues

## Verification
After deployment:
1. Open a loan application with valid PAN number
2. Click "Fetch Credit Report"
3. Check edge function logs for successful XML request/response
4. Confirm real credit data appears (not mock data)
5. Verify the "simulated data" banner is gone
