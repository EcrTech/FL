
# Plan: Fix Database Constraint and Remove Individual Documents Section

## Problem Summary

Two issues need to be resolved:

1. **Database constraint error**: The `loan_generated_documents` table has a CHECK constraint that only allows these document types:
   - `sanction_letter`, `loan_agreement`, `daily_schedule`, `kfs`, `dpn`
   - Missing: `combined_loan_pack`

2. **Individual Documents section still visible**: This section needs to be completely removed since we now use the Combined Loan Pack for everything.

---

## Implementation Steps

### Step 1: Database Migration

Add `combined_loan_pack` to the allowed document types in the CHECK constraint.

```sql
-- Drop existing constraint
ALTER TABLE loan_generated_documents 
DROP CONSTRAINT loan_generated_documents_document_type_check;

-- Add new constraint with combined_loan_pack
ALTER TABLE loan_generated_documents 
ADD CONSTRAINT loan_generated_documents_document_type_check 
CHECK (document_type = ANY (ARRAY[
  'sanction_letter'::text, 
  'loan_agreement'::text, 
  'daily_schedule'::text, 
  'kfs'::text, 
  'dpn'::text,
  'combined_loan_pack'::text
]));
```

### Step 2: Remove Individual Documents Section

**File**: `src/components/LOS/Disbursement/DisbursementDashboard.tsx`

Remove the entire "Individual Documents" Card (approximately lines 515-664), which includes:
- The Card with title "Individual Documents"
- The grid of 3 document cards (Sanction, Agreement, Repayment)
- All the individual Generate/Print/Download/E-Sign buttons
- Upload Signed Document buttons for individual docs

**Keep**:
- The Combined Loan Pack Card (above this section)
- The hidden document templates (needed for PDF generation)
- The eMandate Registration section
- The Upload Signed Document Dialog (may be needed for combined pack)

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| Database | MIGRATE | Add `combined_loan_pack` to document_type CHECK constraint |
| `src/components/LOS/Disbursement/DisbursementDashboard.tsx` | MODIFY | Remove "Individual Documents" section (lines 515-664) |

---

## After Implementation

The Disbursement Dashboard will show:
1. Loan Summary Card
2. **Combined Loan Pack Card** (with Generate, Download, Print, E-Sign, View Signed)
3. eMandate Registration Section

No more individual document cards - everything goes through the Combined Loan Pack.
