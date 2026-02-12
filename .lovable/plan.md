
## Fix Bank Statement Parsing: Use Correct PDF Format

### Root Cause

The `parse-loan-document` edge function currently uses `type: "image_url"` to send PDFs to the AI gateway (Gemini). This is incorrect for PDFs because:
- `type: "image_url"` is designed for **image files** (JPG, PNG, etc.)
- PDFs are not images and should use `type: "file"` format
- When Gemini receives a PDF as `image_url`, it cannot properly process the document content
- This causes empty or incomplete JSON responses, resulting in failed parsing

### Evidence from Testing

**Successful parse (05:54 UTC)**: Used correct format → Got full account details
- `account_number`: 10264703418
- `ifsc_code`: IDFB0081611
- `bank_name`: IDFC FIRST Bank
- All other fields populated correctly
- `parsing_status: completed` with full `ocr_data`

**Recent failed parses (09:23 UTC)**: Using current `type: "image_url"` format → Empty `ocr_data`
- `ocr_data: {}` (empty object)
- `parsing_status: failed`
- Files download successfully (759+ KB), but AI returns no structured data

### Solution: Use `type: "file"` for PDFs

**File**: `supabase/functions/parse-loan-document/index.ts`

**Changes needed**:

1. **Lines 388-393**: Change the PDF request format
```
CURRENT (broken):
  {
    type: "image_url",
    image_url: {
      url: dataUrl,  // data:application/pdf;base64,...
    },
  }

FIXED:
  {
    type: "file",
    file: {
      filename: filename,  // e.g., "bank_statement.pdf"
      file_data: dataUrl,  // data:application/pdf;base64,...
    },
  }
```

2. **Validation**: Keep the existing 0-byte file retry logic (lines 271-288) - this is working correctly

3. **No other changes needed**: The prompt, JSON parsing, and database logic are all correct

### Why This Works

- Gemini's API expects `type: "file"` for PDFs to properly decode and process document content
- The successful parse from 05:54 used this format
- This aligns with the working `parse-cibil-report` function which uses the same `type: "file"` format for PDFs
- The base64 data URL format is compatible with both approaches, but must be paired with `type: "file"` for PDFs

### Testing Plan

After deployment, re-upload a bank statement PDF and verify:
- Parsing status changes to `completed` (not `failed`)
- `ocr_data` contains the 6 account fields:
  - `account_number`
  - `ifsc_code`
  - `branch_name`
  - `account_holder_name`
  - `bank_name`
  - `account_type`
- No empty `ocr_data` object

