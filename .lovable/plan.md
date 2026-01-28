

# Update Equifax API Request Format

## Overview

Update the Equifax credit report edge function to exactly match the user-provided JSON format for API requests.

## Key Changes Required

| Field | Current Value | New Value |
|-------|--------------|-----------|
| `InquiryPurpose` | `"05"` | `"00"` |
| `Gender` | `"1"` (male) / `"2"` (female) | `"M"` / `"F"` |
| `Score` location | Inside `RequestBody` | At **root level** (sibling of RequestHeader/RequestBody) |
| `EmailAddress` | Present (empty) | Remove |
| `GSTStateCode` | Present | Remove |

## Technical Changes

### File: `supabase/functions/equifax-credit-report/index.ts`

**Lines 1055-1115 - Update request structure:**

```typescript
const equifaxRequest = {
  RequestHeader: {
    CustomerId: customerId,
    UserId: userId,
    Password: password,
    MemberNumber: memberNumber,
    SecurityCode: securityCode,
    CustRefField: applicationId,  // Keep for tracking
    ProductCode: ["PCS"],
  },
  RequestBody: {
    InquiryPurpose: "00",  // Changed from "05"
    TransactionAmount: "0",
    FirstName: applicantData.firstName,
    MiddleName: applicantData.middleName || "",
    LastName: applicantData.lastName || "",
    InquiryAddresses: [
      {
        seq: "1",
        AddressLine1: applicantData.address.line1,
        State: stateCode,
        AddressType: ["H"],
        Postal: applicantData.address.postal,
      },
    ],
    InquiryPhones: [
      {
        seq: "1",
        Number: applicantData.mobile,
        PhoneType: ["M"],
      },
    ],
    IDDetails: applicantData.panNumber
      ? [
          {
            seq: "1",
            IDValue: applicantData.panNumber,
            IDType: "T",
            Source: "Inquiry",
          },
        ]
      : [],
    DOB: formatDate(applicantData.dob),
    Gender: applicantData.gender === "male" ? "M" : applicantData.gender === "female" ? "F" : "",  // Changed from 1/2
  },
  Score: [  // Moved to root level as array
    {
      Type: "ERS",
      Version: "4.0",
    },
  ],
};
```

## Changes Summary

| Section | Before | After |
|---------|--------|-------|
| InquiryPurpose | `"05"` (Credit Application) | `"00"` |
| Gender format | `"1"/"2"` | `"M"/"F"` |
| Score placement | Nested in RequestBody | Root level array |
| EmailAddress | Included (empty) | Removed |
| GSTStateCode | Included | Removed |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Update request structure to match exact format |

