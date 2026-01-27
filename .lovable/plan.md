
# Fix: Auto-Sync OCR Data to Existing Applicant Records

## Problem Analysis

The "Verified Document Data" section shows AI-parsed address from the Aadhaar card (`S/O: Ranjit Kumar Jaiswal, ward no 3, Mahua SINGH ray, Mahua, Vaishali, Bihar, 844122`), but the "Applicant Details" section shows `Current Address: N/A`.

**Root Cause**: The system has **TWO separate data sources** that are NOT synchronized:

1. **OCR Data** (AI-parsed) → Stored in `loan_documents.ocr_data` 
2. **Applicant Profile** → Stored in `loan_applicants.current_address`

The `parse-loan-document` edge function saves OCR data but does NOT update the existing `loan_applicants` record. The recently updated `verifiedu-aadhaar-details` function only syncs data from **live API verification** (DigiLocker), not from AI-parsed documents.

**Database Evidence** (5 affected applications found):
| Application | First Name | DOB (Applicant) | Current Address | OCR Address Available |
|-------------|------------|-----------------|-----------------|----------------------|
| 48e426cb... | Kusum | 1990-01-01 | null | Yes (Bihar address) |
| 2a3cbc09... | sonu | 1990-01-01 | email (wrong) | Yes |
| 3bf41430... | Sonu | 1990-01-01 | null | Yes |
| 06216b35... | SAMAN | 1990-01-01 | null | Yes |

## Solution: Auto-Sync OCR to Applicant on Document Parse

Update the `parse-loan-document` edge function to automatically sync key fields (DOB, gender, address) from Aadhaar/PAN OCR data to the `loan_applicants` table when parsing completes.

```text
Current Flow:
┌──────────────────┐    ┌────────────────────────┐
│ Upload Document  │ →  │ parse-loan-document    │ → loan_documents.ocr_data ✓
└──────────────────┘    │ (AI parsing)           │
                        └────────────────────────┘
                                   ↓ (MISSING)
                        loan_applicants NOT updated ✗

Proposed Flow:
┌──────────────────┐    ┌────────────────────────┐
│ Upload Document  │ →  │ parse-loan-document    │ → loan_documents.ocr_data ✓
└──────────────────┘    │ (AI parsing)           │         │
                        └────────────────────────┘         │
                                   ↓ (NEW)                 ↓
                        ┌────────────────────────────────────┐
                        │ Sync DOB, Gender, Address to       │
                        │ loan_applicants (if Aadhaar/PAN)   │
                        └────────────────────────────────────┘
```

## Implementation

### File: `supabase/functions/parse-loan-document/index.ts`

Add sync logic after successful OCR data storage (after line 360):

```typescript
// === NEW: Sync OCR data to loan_applicants for Aadhaar/PAN ===
if (
  (documentType === 'aadhaar_card' || documentType === 'aadhar_card' || documentType === 'pan_card') && 
  !parsedData.parse_error &&
  loanApplicationId
) {
  console.log(`[ParseDocument] Syncing OCR data to loan_applicants for ${documentType}`);
  
  // Find the primary applicant for this application
  const { data: applicant, error: applicantFetchError } = await supabase
    .from("loan_applicants")
    .select("id, dob, current_address, gender")
    .eq("loan_application_id", loanApplicationId)
    .eq("applicant_type", "primary")
    .maybeSingle();
  
  if (applicant && !applicantFetchError) {
    const updateData: Record<string, unknown> = {};
    
    // Sync DOB if currently default placeholder
    if (parsedData.dob && applicant.dob === '1990-01-01') {
      // Validate and format DOB
      const dobDate = new Date(parsedData.dob);
      if (!isNaN(dobDate.getTime())) {
        updateData.dob = parsedData.dob;
      }
    }
    
    // Sync gender from Aadhaar if not set
    if (documentType === 'aadhaar_card' || documentType === 'aadhar_card') {
      if (parsedData.gender && !applicant.gender) {
        updateData.gender = parsedData.gender;
      }
      
      // Sync address if not set (or is null)
      if (parsedData.address && !applicant.current_address) {
        // Parse address into structured format
        // Address format: "S/O: Ranjit Kumar Jaiswal, ward no 3, Mahua, Vaishali, Bihar, 844122"
        const addressStr = parsedData.address;
        
        // Extract pincode (6 digits at end)
        const pincodeMatch = addressStr.match(/(\d{6})\s*$/);
        const pincode = pincodeMatch ? pincodeMatch[1] : '';
        
        // Extract state (common Indian states before pincode)
        const statePatterns = [
          'Bihar', 'Jharkhand', 'West Bengal', 'Uttar Pradesh', 'Maharashtra', 
          'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat', 'Rajasthan', 
          'Madhya Pradesh', 'Andhra Pradesh', 'Telangana', 'Kerala', 
          'Punjab', 'Haryana', 'Odisha', 'Chhattisgarh', 'Assam'
        ];
        let state = '';
        for (const s of statePatterns) {
          if (addressStr.toLowerCase().includes(s.toLowerCase())) {
            state = s;
            break;
          }
        }
        
        // Build structured address
        updateData.current_address = {
          line1: addressStr, // Full address as line1
          line2: '',
          city: '',
          state: state,
          pincode: pincode
        };
      }
    }
    
    // Perform update if we have changes
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("loan_applicants")
        .update(updateData)
        .eq("id", applicant.id);
      
      if (updateError) {
        console.warn(`[ParseDocument] Failed to sync OCR to applicant:`, updateError);
      } else {
        console.log(`[ParseDocument] Synced OCR data to applicant:`, updateData);
      }
    }
  }
}
```

### Additional Requirement: Get `loan_application_id`

The edge function currently receives `documentId` but needs the `loan_application_id` to find the applicant. Modify the document fetch query (around line 200) to also fetch the application ID:

```typescript
// Fetch document with application ID
const { data: document, error: docError } = await supabase
  .from("loan_documents")
  .select("id, document_type, file_url, loan_application_id")  // Add loan_application_id
  .eq("id", documentId)
  .single();

// Store for later use
const loanApplicationId = document.loan_application_id;
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/parse-loan-document/index.ts` | Add OCR-to-applicant sync logic after document parsing |

## Address Parsing Logic

The OCR address string `S/O: Ranjit Kumar Jaiswal, ward no 3, Mahua SINGH ray, Mahua, Vaishali, Bihar, 844122` will be parsed as:

| Field | Extracted Value |
|-------|-----------------|
| `line1` | Full address string |
| `state` | "Bihar" (pattern matched) |
| `pincode` | "844122" (6-digit regex) |

## Sync Rules (Preventing Data Corruption)

- **DOB**: Only sync if current value is the placeholder `1990-01-01`
- **Gender**: Only sync from Aadhaar if currently null/empty
- **Address**: Only sync if `current_address` is null
- **Priority**: Live API verification (DigiLocker) always takes precedence when triggered later

## Testing After Deployment

1. Upload a new Aadhaar card to any application
2. Wait for AI parsing to complete
3. Verify the Applicant Details section auto-populates:
   - Date of Birth (from OCR)
   - Gender (from Aadhaar)
   - Current Address with state and pincode

## Backfill for Existing Applications

After the fix is deployed, existing applications with parsed OCR data but missing applicant fields can be fixed by:
1. Re-uploading the Aadhaar document, OR
2. Triggering the DigiLocker verification flow, OR
3. Running a one-time SQL backfill script (can provide separately if needed)
