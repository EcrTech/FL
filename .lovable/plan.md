
# Add Name and Loan Number Search to Sanctions Page

## Problem Summary

The Sanctions page (`/los/sanctions`) currently has filters for status, amount range, date range, and approver - but **no search functionality** to quickly find applications by:
- Applicant name
- Loan ID / Application number

## Current State

The Sanctions page filter bar includes:
- Status filter (New, Pending, Emailed, Signed)
- Amount range (Min/Max)
- Date range picker
- Approved By dropdown
- Clear filters button

**Missing**: A text search box for name/loan number lookup.

## Solution

Add a prominent search input field that filters applications by:
- Applicant name (partial match)
- Loan ID (partial match)
- Application number (partial match)

## Implementation Details

### Changes to `src/pages/LOS/Sanctions.tsx`

1. **Add search state variable**
   ```typescript
   const [searchTerm, setSearchTerm] = useState<string>("");
   ```

2. **Add Search icon import**
   ```typescript
   import { Search, Eye, CheckCircle, ... } from "lucide-react";
   ```

3. **Add search input to filter bar** (before the status filter)
   ```typescript
   <div className="relative">
     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
     <Input
       placeholder="Search by name or loan number..."
       value={searchTerm}
       onChange={(e) => setSearchTerm(e.target.value)}
       className="pl-10 w-[250px]"
     />
   </div>
   ```

4. **Update filter logic** to include search:
   ```typescript
   const filteredApplications = applications?.filter((app) => {
     // Search filter (name, loan_id, application_number)
     if (searchTerm) {
       const search = searchTerm.toLowerCase();
       const matchesName = app.applicant_name?.toLowerCase().includes(search);
       const matchesLoanId = app.loan_id?.toLowerCase().includes(search);
       const matchesAppNumber = app.application_number?.toLowerCase().includes(search);
       if (!matchesName && !matchesLoanId && !matchesAppNumber) return false;
     }
     
     // ... existing filters
   });
   ```

5. **Update hasActiveFilters** to include search:
   ```typescript
   const hasActiveFilters = searchTerm || statusFilter !== "all" || ...;
   ```

6. **Update clearFilters** to reset search:
   ```typescript
   const clearFilters = () => {
     setSearchTerm("");
     setStatusFilter("all");
     // ...
   };
   ```

## Visual Layout

```text
Current Layout:
┌─────────────────────────────────────────────────────────────────────┐
│ [Filter icon] [Status ▼] [Min ₹ - Max ₹] [Date range] [Approved ▼] │
└─────────────────────────────────────────────────────────────────────┘

New Layout:
┌───────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search by name or loan number...] [Status ▼] [Min-Max] [Date] [Approved ▼]   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/LOS/Sanctions.tsx` | Add search input and filter logic |

## Technical Notes

- Search is case-insensitive
- Matches partial strings (contains match, not exact)
- Searches across: applicant_name, loan_id, application_number
- No debounce needed since filtering is done client-side on already-fetched data
