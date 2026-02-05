
# Fix E-Sign to Use Full Combined Loan Pack PDF (11 pages)

## Problem

The Nupay E-Sign is showing only a 1-page placeholder document instead of the full 11-page Combined Loan Pack (Sanction Letter + Loan Agreement + Daily Repayment Schedule).

### Current Flow (Broken)
1. User clicks "Generate Combined Pack" → Creates DB record with `file_path: null`
2. User clicks "Download" → `html2pdf` generates 11-page PDF on client, downloads it
3. User clicks "E-Sign" → Edge function creates its own 1-page placeholder PDF → Sends to Nupay

### Required Flow (Fixed)
1. User clicks "Generate Combined Pack" → Generates PDF on client → **Uploads to Storage** → Saves `file_path` to DB
2. User clicks "E-Sign" → Edge function **fetches the stored PDF** → Sends full 11-page document to Nupay

## Implementation

### Phase 1: Upload PDF to Storage on Generate

#### File: `src/components/LOS/Disbursement/DisbursementDashboard.tsx`

Update the `generateMutation` to:
1. Generate PDF using html2pdf on client
2. Upload PDF to Supabase Storage
3. Save the `file_path` to the database record

```typescript
const generateMutation = useMutation({
  mutationFn: async (docType: DocumentType) => {
    const docNumber = `${docType.toUpperCase().replace("_", "")}-${Date.now().toString(36).toUpperCase()}`;
    
    // Get the template element
    const templateId = docType === "combined_loan_pack" 
      ? "combined-loan-pack-template"
      : `${docType}-template`;
    const printElement = document.getElementById(templateId);
    
    let filePath: string | null = null;
    
    if (printElement) {
      // Generate PDF blob
      const pdfBlob = await html2pdf()
        .set({
          margin: 10,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        })
        .from(printElement)
        .outputPdf('blob');
      
      // Upload to storage
      const fileName = `${applicationId}/${docType}/${docNumber}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, pdfBlob, { contentType: 'application/pdf' });
      
      if (!uploadError) {
        filePath = fileName;
      }
    }
    
    // Insert record with file_path
    const { data, error } = await supabase
      .from("loan_generated_documents")
      .insert({
        loan_application_id: applicationId,
        sanction_id: sanction?.id || null,
        org_id: application!.org_id,
        document_type: docType,
        document_number: docNumber,
        file_path: filePath,  // NEW: Save file path
        status: "generated",
      })
      .select()
      .single();

    if (error) throw error;
    return { data, docType };
  },
  // ... rest of mutation
});
```

### Phase 2: Fetch Stored PDF in Edge Function

#### File: `supabase/functions/nupay-esign-request/index.ts`

Replace the `createPdfFromDocument` function with one that fetches the actual stored PDF:

```typescript
async function getPdfFromStorage(
  supabase: SupabaseClient,
  documentId: string
): Promise<Uint8Array> {
  // Fetch the document record to get file_path
  const { data: docRecord, error: docError } = await supabase
    .from("loan_generated_documents")
    .select("file_path, document_type")
    .eq("id", documentId)
    .single();

  if (docError || !docRecord) {
    throw new Error(`Document not found: ${documentId}`);
  }

  if (!docRecord.file_path) {
    throw new Error("Document has no file stored. Please regenerate the document.");
  }

  // Download the PDF from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("loan-documents")
    .download(docRecord.file_path);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download document: ${downloadError?.message}`);
  }

  // Convert Blob to Uint8Array
  const arrayBuffer = await fileData.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
```

Update the main flow to use this function:

```typescript
// In serve() handler, replace:
// const pdfBytes = await createPdfFromDocument(supabase, document_id, document_type, application_id);

// With:
const pdfBytes = await getPdfFromStorage(supabase, document_id);
```

### Phase 3: Handle Regeneration

If a document already exists, update its `file_path` when regenerated.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/LOS/Disbursement/DisbursementDashboard.tsx` | Update `generateMutation` to upload PDF to storage and save `file_path` |
| `supabase/functions/nupay-esign-request/index.ts` | Replace `createPdfFromDocument` with `getPdfFromStorage` that fetches from storage |

## Technical Considerations

1. **html2pdf API**: Use `.outputPdf('blob')` to get a blob for upload instead of triggering download
2. **Storage bucket**: Use existing `loan-documents` bucket with path `{applicationId}/{docType}/{docNumber}.pdf`
3. **Error handling**: If PDF fetch fails, show user-friendly error asking to regenerate document
4. **Existing documents**: Documents generated before this fix will have `file_path: null` and will need regeneration

## Testing Steps

1. Navigate to a loan application in Disbursement stage
2. Click "Generate Combined Pack" → Verify it appears with status "Generated"
3. Check database: `loan_generated_documents.file_path` should have a value like `{uuid}/combined_loan_pack/{docNumber}.pdf`
4. Click "E-Sign" button → Complete the e-sign flow
5. Verify the Nupay Signature Panel shows all 11 pages (Sanction Letter + Loan Agreement + Daily Schedule)

## Rollback Plan

If issues arise, the `createPdfFromDocument` fallback function can be kept to generate placeholder PDFs when `file_path` is null, while logging a warning.
