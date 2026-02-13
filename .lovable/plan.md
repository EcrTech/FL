
## Add Filters to Approval Queue

### Overview
Add a comprehensive filter bar above the Approval Queue table so users can quickly narrow down the 65+ applications. Filters will be based on the columns visible in the table and the available data.

### Filters to Add

1. **Search** (text input) -- Search by Loan ID, Application #, or Applicant name
2. **Current Stage** (multi-select dropdown) -- Filter by stage: Application Login, Credit Assessment, Approval Pending, Sanctioned, Disbursement Pending, Disbursed, etc.
3. **Assigned To** (dropdown) -- Filter by staff member the application is assigned to
4. **Amount Range** (min/max inputs) -- Filter by requested loan amount
5. **Date Range** (date picker) -- Filter by created date (from/to)
6. **Product Type** (dropdown) -- Filter by the `product_type` field on loan applications

### Technical Details

#### File: `src/components/LOS/Approval/ApprovalQueue.tsx`

**Changes:**
- Add filter state variables: `searchQuery`, `selectedStages`, `selectedAssignee`, `amountMin`, `amountMax`, `dateFrom`, `dateTo`, `selectedProductType`
- Add a filter bar section between the card header and the table, containing:
  - A search `Input` with a search icon
  - A `Select` dropdown for Current Stage (multi-select via checkboxes in a Popover)
  - A `Select` dropdown for Assigned To (populated from distinct assignees in the data)
  - Min/Max amount `Input` fields
  - Date range pickers using the existing `react-day-picker` / Popover pattern
  - A "Clear Filters" button
- Apply all filters client-side using `useMemo` to create a `filteredApplications` array from the fetched `applications` data
- Update the table to render `filteredApplications` instead of `applications`
- Update the count in `CardDescription` to show filtered vs total count (e.g., "Showing 12 of 65 applications")

**Filter logic (client-side in useMemo):**
- Search: case-insensitive match against `loan_id`, `application_number`, and applicant `first_name`/`last_name`
- Stage: include if `current_stage` is in selected set (or show all if none selected)
- Assigned To: match `assigned_to` UUID
- Amount: `requested_amount >= amountMin` and `requested_amount <= amountMax`
- Date: `created_at` between `dateFrom` and `dateTo`
- Product Type: match `product_type`

#### No database or migration changes required
All filtering is done client-side on the already-fetched data.

#### Files Changed
| File | Change |
|------|--------|
| `src/components/LOS/Approval/ApprovalQueue.tsx` | Add filter bar UI and client-side filtering logic |
