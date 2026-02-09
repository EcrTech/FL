

## Make Disbursal Table Rows Clickable

### What Changes
Each row in the Disbursals table will become clickable, navigating to the Application Detail page (with the disbursement tab pre-selected). This gives quick access to full loan details from the disbursal list.

### How It Works
- Clicking anywhere on a row navigates to `/los/applications/{id}?tab=disbursement`
- The row will show a pointer cursor on hover for visual feedback
- The "Complete" (upload UTR) button will still work independently without triggering row navigation (using `stopPropagation`)

### Technical Details

**File: `src/pages/LOS/Disbursals.tsx`**

1. Add `onClick` and `cursor-pointer` styling to each `<TableRow>`:
   ```tsx
   <TableRow
     key={item.id}
     className="cursor-pointer hover:bg-muted/50"
     onClick={() => navigate(`/los/applications/${item.application_id}?tab=disbursement`)}
   >
   ```

2. Add `e.stopPropagation()` to the action buttons (both "Complete" and "View") so clicking them doesn't also trigger row navigation:
   ```tsx
   onClick={(e) => { e.stopPropagation(); setUploadDialogItem(item); }}
   ```

Single file change, no database modifications needed.
