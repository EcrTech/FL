

## Fix: Broken `get_visible_user_ids` Function Crashing for Non-Admin Users

### The Problem
There are two issues preventing Shivam from seeing leads:

**1. Bug in `get_visible_user_ids()` (critical)**
The function calls `SELECT array_agg(id) FROM get_subordinates(...)`, but `get_subordinates()` returns columns named `designation_id` and `level` -- there is no `id` column. This causes a runtime error for every non-admin user, which makes the RLS policy on `contacts` fail silently and return zero rows.

**2. No leads are assigned to Shivam**
All 169 contacts in the organization have `assigned_to = NULL`. However, the RLS policy is designed to show unassigned leads to everyone (`assigned_to IS NULL` passes the check), so they *should* be visible -- but the crashing function prevents this.

### The Fix
Update `get_visible_user_ids()` to reference the correct column name (`designation_id` instead of `id`) from the `get_subordinates()` function.

### Technical Details

**Single database migration** to replace the function, fixing line 28:

Change:
```sql
SELECT array_agg(id) INTO _subordinate_ids
FROM get_subordinates(_designation_id);
```

To:
```sql
SELECT array_agg(designation_id) INTO _subordinate_ids
FROM get_subordinates(_designation_id);
```

The full function will be re-created with `CREATE OR REPLACE FUNCTION` containing this fix. No other changes are needed -- once the function stops crashing, the existing RLS policy will correctly show Shivam:
- All unassigned leads (169 currently)
- Any leads assigned to him or his subordinates in the future

No frontend changes required.
