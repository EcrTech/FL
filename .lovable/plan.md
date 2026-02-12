
## Bulk Lead Upload on Pipeline Page

Add a "Bulk Upload" button to the Pipeline Board header that opens a CSV upload dialog, allowing users to import multiple leads at once. Each CSV row creates a contact and a corresponding loan application.

### User Experience

1. A new "Bulk Upload" button appears next to "Advanced Search" in the Pipeline header
2. Clicking it opens a dialog with:
   - Download CSV template button
   - Drag-and-drop file upload area
   - Validation feedback
   - Upload button
3. The CSV template includes columns: `name`, `phone`, `email`, `loan_amount`, `source`
4. On upload, each row creates a contact (deduped by phone) and a draft loan application
5. Success/error toast notifications

### Technical Details

**New file: `src/components/Pipeline/BulkLeadUploadDialog.tsx`**
- Dialog component with drag-and-drop CSV upload
- CSV template download with columns: `name`, `phone`, `email`, `loan_amount`, `source`
- Client-side validation: CSV format, max 500 rows, required `name` + `phone` columns
- Uses PapaParse for CSV parsing
- For each row:
  - Check if contact exists by phone number (dedup)
  - Create or reuse contact record with `source: 'bulk_upload'`
  - Create a draft `loan_application` linked to the contact
- Uses `supabase.from("contacts")` and `supabase.from("loan_applications")` directly
- Shows progress and result summary (created/skipped/errors)

**Modified file: `src/pages/PipelineBoard.tsx`**
- Import the new `BulkLeadUploadDialog` component
- Add state: `showBulkUpload`
- Add "Bulk Upload" button in the header next to "Advanced Search"
- Render the dialog, passing `orgId` and a callback to refresh the query

### Processing Logic (client-side, per row)

```text
For each CSV row:
  1. Look up contact by phone in org
  2. If not found -> insert new contact
  3. Insert loan_application (status: 'new', current_stage: 'lead', source from CSV or 'bulk_upload')
  4. Track results for summary
```

### CSV Template Columns

| Column | Required | Description |
|--------|----------|-------------|
| name | Yes | Full name (split into first/last) |
| phone | Yes | Phone number (used for dedup) |
| email | No | Email address |
| loan_amount | No | Requested amount (default: 25000) |
| source | No | Lead source (default: 'bulk_upload') |
