

## Aadhaar Card: Multi-File Upload (Front and Back)

### What Changes

Instead of a single Aadhaar card upload, the Aadhaar section will show **two separate cards** -- "Aadhaar Front" and "Aadhaar Back" -- each with its own upload, view, and replace actions.

### File Changes

#### 1. `src/components/LOS/VerificationDashboard.tsx`

- Add a `getAadhaarBackDocument()` helper (similar to existing `getAadhaarDocument()` which finds front)
- Replace the single `IdentityDocumentCard` for Aadhaar with **two cards** side by side:
  - "Aadhaar Front" using document type `aadhaar_front`
  - "Aadhaar Back" using document type `aadhaar_back`
- Update `uploadDocType` state type to include `"aadhaar_front"` and `"aadhaar_back"` (replacing `"aadhaar_card"`)
- Update the `existingDocumentId` logic in the upload dialog to map front/back correctly

#### 2. `src/components/LOS/Verification/IdentityDocumentUploadDialog.tsx`

- Expand the `documentType` prop type from `"pan_card" | "aadhaar_card"` to `"pan_card" | "aadhaar_card" | "aadhaar_front" | "aadhaar_back"`
- Update `documentLabel` logic to show "Aadhaar Card (Front)" or "Aadhaar Card (Back)" for the new types

#### 3. `src/components/LOS/Verification/IdentityDocumentCard.tsx`

- No structural changes needed -- it already accepts any `type` string and `label` prop

### Result

The Aadhaar verification section will display two document slots side by side (Front + Back), each independently uploadable, viewable, and replaceable. Both are stored as separate records (`aadhaar_front`, `aadhaar_back`) in the `loan_documents` table, which is already supported by the existing query and public application form.
