
## Fix: Aadhaar Card Data Not Showing in Verified Document Data

### Root Cause
The code in three files calls `getParsedData("aadhaar_card")` / `getOcrData("aadhaar_card")`, but Aadhaar documents are stored with types `aadhaar_front` and `aadhaar_back` -- not `aadhaar_card`. Since no document matches `aadhaar_card`, the Aadhaar section never renders.

### Database Evidence
- `aadhaar_front` (id: `61150a6e`) has OCR data: name, DOB, gender, aadhaar_number
- `aadhaar_back` (id: `c2a29356`) has OCR data: full address, aadhaar_number
- No document with type `aadhaar_card` exists

### Fix
Update the Aadhaar data lookup in all three files to merge data from both `aadhaar_front` and `aadhaar_back` documents.

### Files to Change

**1. `src/pages/LOS/ApplicationDetail.tsx` (line ~386)**
- Replace `getParsedData("aadhaar_card")` with logic that merges `aadhaar_front` and `aadhaar_back` OCR data
- Front provides: name, DOB, gender, aadhaar_number
- Back provides: address, aadhaar_number (with formatting)

**2. `src/pages/LOS/SanctionDetail.tsx`**
- Same fix as ApplicationDetail -- update the Aadhaar lookup to check `aadhaar_front` and `aadhaar_back`

**3. `src/components/LOS/DocumentDataVerification.tsx` (line ~129)**
- Replace `getOcrData("aadhaar_card")` with merged front+back data

### Technical Details

The merged logic will look like:

```typescript
const aadhaarFrontData = getParsedData("aadhaar_front");
const aadhaarBackData = getParsedData("aadhaar_back");
const aadhaarDocData = (aadhaarFrontData || aadhaarBackData) ? {
  ...aadhaarBackData,
  ...aadhaarFrontData,
  // Back has structured address, prefer it
  address: aadhaarBackData?.aadhaar_card_details?.address?.english
    ? [
        aadhaarBackData.aadhaar_card_details.address.english.s_o,
        aadhaarBackData.aadhaar_card_details.address.english.house_number_or_locality,
        aadhaarBackData.aadhaar_card_details.address.english.state_and_pincode,
      ].filter(Boolean).join(", ")
    : aadhaarFrontData?.address,
} : null;
```

This ensures front data (name, DOB, gender) and back data (address) are combined into the displayed Aadhaar section.
