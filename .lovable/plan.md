

## Fix: Split Aadhaar into Front and Back in Document Upload Section

### Problem

The **Verification Dashboard** already has Aadhaar split into "Aadhaar Front" and "Aadhaar Back" as two separate upload cards. However, the **Document Upload** page (`DocumentUpload.tsx`) still lists Aadhaar as a single entry (`aadhaar_card`), so users only see one upload slot there.

### Fix

**File: `src/components/LOS/DocumentUpload.tsx`**

Replace the single Aadhaar entry in the `REQUIRED_DOCUMENTS` array (line 41) with two entries:

| Before | After |
|---|---|
| `{ type: "aadhaar_card", name: "Aadhaar Card", ... }` | `{ type: "aadhaar_front", name: "Aadhaar Card (Front)", ... }` |
| | `{ type: "aadhaar_back", name: "Aadhaar Card (Back)", ... }` |

Both entries keep the same properties: `category: "identity"`, `mandatory: true`, `parseable: true`.

This single change ensures:
- Two separate rows appear in the document upload table (front and back)
- Each can be uploaded, viewed, parsed, and approved independently
- The Verification Dashboard (which already uses `aadhaar_front` / `aadhaar_back`) stays consistent
- Existing documents stored as `aadhaar_front` or `aadhaar_back` will be correctly matched

### Files to Modify

| File | Change |
|---|---|
| `src/components/LOS/DocumentUpload.tsx` | Replace single `aadhaar_card` entry with `aadhaar_front` and `aadhaar_back` entries in `REQUIRED_DOCUMENTS` array |

