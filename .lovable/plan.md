

# Fix: Sync Contact Assignment When Loan Application Is Assigned

## Root Cause
When the admin assigns a loan application to a team member (via the "Reassign" dialog), only `loan_applications.assigned_to` is updated. The linked `contacts.assigned_to` remains NULL. Since the RLS policy on `contacts` only allows non-admin members to see contacts explicitly assigned to them, the team member cannot see:
- Contact details (name, phone) on the Applications page
- Leads on the Calling Leads page (which queries `contacts` directly)

## Solution

### 1. Database Trigger: Sync assignment from loan_applications to contacts
Create a trigger on `loan_applications` that fires AFTER UPDATE of `assigned_to`. When `assigned_to` changes, it updates the linked `contacts.assigned_to` to match.

This covers all assignment paths: manual reassignment, bulk upload with assignment, and the auto-assign trigger.

### 2. One-time data fix: Backfill existing records
Update all `contacts` where `assigned_to IS NULL` but the linked `loan_applications.assigned_to` is set, syncing the value.

### 3. No frontend changes needed
The AssignmentDialog and all other UI components continue to work as-is. The trigger handles the propagation transparently at the database level.

## Technical Details

### Migration SQL

```sql
-- Trigger function: sync assigned_to from loan_applications to contacts
CREATE OR REPLACE FUNCTION public.sync_contact_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND
     (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    UPDATE contacts
    SET assigned_to = NEW.assigned_to
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on loan_applications
CREATE TRIGGER sync_contact_assignment_on_update
AFTER UPDATE OF assigned_to ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_contact_assignment();

-- Also sync on INSERT (for bulk uploads with pre-set assignment)
CREATE TRIGGER sync_contact_assignment_on_insert
AFTER INSERT ON public.loan_applications
FOR EACH ROW
WHEN (NEW.assigned_to IS NOT NULL AND NEW.contact_id IS NOT NULL)
EXECUTE FUNCTION public.sync_contact_assignment();

-- Backfill existing records
UPDATE contacts c
SET assigned_to = la.assigned_to
FROM loan_applications la
WHERE la.contact_id = c.id
  AND la.assigned_to IS NOT NULL
  AND c.assigned_to IS NULL;
```

| Change | Type | Details |
|--------|------|---------|
| `sync_contact_assignment()` function | DB migration | Propagates assignment from loan_applications to contacts |
| Trigger on UPDATE | DB migration | Fires when `assigned_to` changes on loan_applications |
| Trigger on INSERT | DB migration | Fires when a new loan_application is created with assignment |
| Backfill existing data | DB migration | Fixes all current mismatched records |
