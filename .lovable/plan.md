

## Credit Bureau API Migration to PCS (CIR 360 JSON) for UAT

### What's Changing

The edge function needs to be updated to match the exact request format provided by the product team (the sample request) and correctly parse the new PCS JSON response format. The API itself is already JSON-based, but there are structural mismatches between what we currently send and what the UAT environment expects.

---

### Key Differences: Current Request vs. Sample Request

| Field | Current Code (line ~1207) | Sample Request | Action |
|---|---|---|---|
| `RequestBody.InquiryPurpose` | `"00"` | `"00"` | OK (matches) |
| `RequestBody.TransactionAmount` | `"0"` (included) | Not present | **Remove** |
| `RequestBody.MiddleName` | Included | Not present | **Remove if empty** |
| `RequestBody.LastName` | Included | Not present | **Remove if empty** |
| `RequestBody.DOB` | Present in RequestBody | Present in RequestBody | OK |
| `RequestBody.Gender` | Present in RequestBody | **Not present** | **Remove** (PCS doesn't require it) |
| `RequestBody.IDDetails` | Only PAN (1 item if present) | **7 ID types** sent (PAN, Passport, Voter, DL, Aadhaar, Ration, Other) with empty values | **Send all 7 ID slots**, empty values for unavailable IDs |
| `Score` placement | Root level (correct) | Root level | OK |
| `Score[0].Type` | `"ERS"` | `"ERS"` | OK |
| `Score[0].Version` | `"4.0"` | `"4.0"` | OK |
| Redacted storage `InquiryPurpose` | `"05"` (line 1374 -- mismatched!) | Should be `"00"` | **Fix** |
| Redacted storage `Gender` | `"1"/"2"` (line 1397 -- wrong format) | Should be `"M"/"F"` | **Fix** |
| `Accept` header | `"text/plain"` | Should be `"application/json"` | **Fix** |

### Key Differences: Response Parsing

The sample response shows the PCS CIR 360 JSON structure. The current parser (`parseEquifaxResponse`) already handles this path via `CCRResponse.CIRReportDataLst[0]`, but there are extraction issues:

1. **Score Location**: In the sample response, `Score` is at `CIRReportDataLst[0].Score` (an array with `Type` and `Version` but NO numeric score value there). The actual numeric score is inside `CIRReportData.ScoreDetails` -- need to verify the parser reaches it.

2. **RetailAccountsSummary**: The sample response uses `RetailAccountSummary` (no "s" at end) per the spec (page 41 of PDF). Current code looks for `RetailAccountsSummary` (with "s"). Need to handle both.

3. **Account fields**: Sample response uses `Balance` (not `CurrentBalance`), `PastDueAmount` (not `AmountPastDue`), `HighCredit` (not `SanctionAmount` for credit cards), `CreditLimit`, `InterestRate`, `CollateralValue`, `CollateralType`, `AssetClassification` -- some of these are already handled via fallbacks, but new fields should be captured.

4. **IdentityInfo structure**: Response nests PANId, VoterID, NationalIDCard under `IdentityInfo` (already partially handled).

---

### Implementation Steps

**1. Update Request Builder (lines ~1207-1267)**
- Remove `TransactionAmount`
- Remove `Gender` from RequestBody
- Only include `MiddleName` and `LastName` if non-empty
- Send all 7 IDDetails slots (PAN=T, Passport=P, Voter=V, DL=D, Aadhaar=M, Ration=R, Other=O) with empty IDValue for unavailable types
- Fix `Accept` header from `"text/plain"` to `"application/json"`

**2. Update Response Parser (parseEquifaxResponse, lines ~615-857)**
- Add fallback for `RetailAccountSummary` (without trailing "s")
- Ensure score extraction checks `CIRReportData.ScoreDetails` array properly for numeric `Score` or `Value`
- Capture new account fields: `InterestRate`, `CreditLimit`, `CollateralValue`, `CollateralType`, `AssetClassification`, `HighCredit`
- Handle `Open` field ("Yes"/"No") for determining account status alongside `AccountStatus`

**3. Fix Redacted Request Storage (lines ~1362-1399)**
- Change `InquiryPurpose` from `"05"` to `"00"` to match actual request
- Change Gender mapping from `"1"/"2"` to `"M"/"F"` (or remove since we're removing Gender from request)
- Include all 7 IDDetails slots in redacted storage

**4. Remove XML-related code**
- The `jsonToXmlPlain()`, `jsonToSoapXml()`, `xmlToJson()`, `escapeXml()`, and all XML helper functions (lines ~198-601) are dead code since the API is JSON-only. Remove them to reduce function size and improve cold-start performance.

**5. Remove Mock Data**
- The `generateMockResponse()` function (lines ~859-1033) should be removed per the established pattern of no mock data fallbacks.

**6. Update UAT Credentials**
- The secrets `EQUIFAX_CUSTOMER_ID`, `EQUIFAX_USER_ID`, `EQUIFAX_PASSWORD`, `EQUIFAX_MEMBER_NUMBER`, `EQUIFAX_SECURITY_CODE`, and `EQUIFAX_API_URL` need to be updated with the UAT values from the sample request:
  - CustomerId: `21`
  - UserId: `UAT_SPEFIN`
  - Password: (from sample)
  - MemberNumber: `027BB02400`
  - SecurityCode: `N42`
  - API URL: needs to be confirmed (UAT endpoint)

---

### Technical Details

**Updated Request Structure (matching sample exactly):**

```json
{
  "RequestHeader": {
    "CustomerId": "21",
    "UserId": "UAT_SPEFIN",
    "Password": "***",
    "MemberNumber": "027BB02400",
    "SecurityCode": "N42",
    "CustRefField": "<applicationId>",
    "ProductCode": ["PCS"]
  },
  "RequestBody": {
    "InquiryPurpose": "00",
    "FirstName": "SATHISH KUMAR",
    "DOB": "1996-06-03",
    "InquiryAddresses": [{
      "seq": "1",
      "AddressType": ["H"],
      "AddressLine1": "...",
      "State": "TN",
      "Postal": "641045"
    }],
    "InquiryPhones": [{
      "seq": "1",
      "PhoneType": ["M"],
      "Number": "8122244473"
    }],
    "IDDetails": [
      {"seq": "1", "IDType": "T", "IDValue": "BUXPS2681D", "Source": "Inquiry"},
      {"seq": "2", "IDType": "P", "IDValue": "", "Source": "Inquiry"},
      {"seq": "3", "IDType": "V", "IDValue": "", "Source": "Inquiry"},
      {"seq": "4", "IDType": "D", "IDValue": "", "Source": "Inquiry"},
      {"seq": "5", "IDType": "M", "IDValue": "", "Source": "Inquiry"},
      {"seq": "6", "IDType": "R", "IDValue": "", "Source": "Inquiry"},
      {"seq": "7", "IDType": "O", "IDValue": "", "Source": "Inquiry"}
    ]
  },
  "Score": [{"Type": "ERS", "Version": "4.0"}]
}
```

**Files to modify:**
- `supabase/functions/equifax-credit-report/index.ts` (single file -- all changes are here)

**Secrets to update (user action required):**
- `EQUIFAX_CUSTOMER_ID` -> `21`
- `EQUIFAX_USER_ID` -> `UAT_SPEFIN`
- `EQUIFAX_PASSWORD` -> value from sample
- `EQUIFAX_MEMBER_NUMBER` -> `027BB02400`
- `EQUIFAX_SECURITY_CODE` -> `N42`
- `EQUIFAX_API_URL` -> UAT endpoint URL (to be confirmed by user)

