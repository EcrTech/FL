

## Feature: Add Optional Assignment Column to Bulk Lead Upload CSV

### Overview
Extend the bulk lead upload functionality to support an optional `assigned_to` column in the CSV. This allows users to automatically assign uploaded leads to specific team members during the import process, bypassing the need for manual assignment afterwards.

### Current State Analysis
- **Bulk Upload Dialog**: Currently accepts CSV with columns: `name`, `phone`, `email`, `loan_amount`, `source`
- **Assignment System**: The system has manual assignment via `AssignmentDialog` that updates the `assigned_to` field in `loan_applications`
- **Round-Robin Config**: There's a `loan_assignment_config` table tracking round-robin assignment state, but bulk uploads currently don't use it
- **Edge Function**: The `bulk-lead-upload` function creates contacts and loan applications using the service role

### Design Approach

**Three assignment options during bulk upload:**
1. **Leave unassigned** (default) - Current behavior, `assigned_to` stays null
2. **Specify in CSV** - Optional `assigned_to_email` or `assigned_to_name` column for per-row assignment
3. **Auto-assign via round-robin** - A new checkbox option "Auto-assign to team members" that leverages the existing `get_next_assignee()` database function

### Implementation Details

**Modified Files:**

1. **`src/components/Pipeline/BulkLeadUploadDialog.tsx`**
   - Add new UI section: "Assignment Strategy" with three radio options
     - Option 1: "Leave Unassigned"
     - Option 2: "Use CSV Column" (shows when valid column detected)
     - Option 3: "Auto-Assign (Round-Robin)" (shows with checkbox)
   - Validate that if "Use CSV Column" is selected, the CSV has either `assigned_to_email` or `assigned_to_name`
   - Update CSV template to show optional `assigned_to_email` column
   - Pass assignment strategy and selection to the edge function

2. **`supabase/functions/bulk-lead-upload/index.ts`** (edge function)
   - Accept new body parameter: `assignmentStrategy` (one of: "unassigned", "csv", "round_robin") and optional `assigneeSelection` (from radio buttons)
   - For each row:
     - If strategy is "unassigned": set `assigned_to` to null
     - If strategy is "csv": 
       - Look up the user by email or name in the org and get their ID
       - Log error if user not found, skip assignment for that row
     - If strategy is "round_robin":
       - Call the `get_next_assignee(org_id)` function to get the next assignee ID
       - Set `assigned_to` to that ID
   - Update the response to include assignment success/failure counts

**CSV Template Update:**
```
name,phone,email,loan_amount,source,assigned_to_email
John Doe,9876543210,john@example.com,50000,website,sales_agent_1@company.com
Jane Smith,9876543211,,25000,,
```

### User Experience Flow

1. User opens "Bulk Upload" dialog
2. Downloads CSV template (which now shows optional `assigned_to_email` column)
3. Selects CSV file
4. Before uploading, selects an assignment strategy:
   - "Leave Unassigned" (no additional setup)
   - "Use CSV Column" (requires `assigned_to_email` or `assigned_to_name` in CSV)
   - "Auto-Assign (Round-Robin)" (automatically cycles through active Sales Agents)
5. Clicks "Upload"
6. Results show assignment success alongside creation/skip counts

### Technical Considerations

- **Email vs Name Matching**: Email is more reliable, but name matching is user-friendly. Support both for flexibility.
- **Round-Robin Integration**: The existing `get_next_assignee(org_id)` function handles the round-robin logic server-side
- **Error Handling**: If a CSV-specified user isn't found or round-robin fails, the lead is still created but left unassigned with an error logged
- **Validation**: Client-side warns if "Use CSV Column" is selected but no valid column is detected
- **Backward Compatibility**: Existing bulk uploads without assignment data continue to work as before

### Benefits

- Reduces manual post-upload assignment work
- Enables automatic lead distribution via round-robin
- Flexible: Users can mix strategies (some rows with CSV assignment, some unassigned)
- Improves workflow efficiency for large team operations

