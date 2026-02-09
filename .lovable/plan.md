

## Fix: Admins Can View All Data

### The Problem
The `get_visible_user_ids()` database function checks `profiles.role` to detect admins, but the `profiles` table has no `role` column. Roles are stored in the separate `user_roles` table. This means admin/super_admin users are never recognized, and they get the same restricted view as regular users.

### The Fix
Update the `get_visible_user_ids()` function to check the `user_roles` table instead of a non-existent `profiles.role` column.

### Technical Details

**Single migration** to replace the function:

Change this logic:
```sql
-- BROKEN: profiles has no 'role' column
SELECT p.org_id, p.role, p.designation_id
INTO _org_id, _role, _designation_id
FROM profiles p WHERE p.id = _user_id;

IF _role IN ('admin', 'super_admin') THEN
  RETURN NULL;
END IF;
```

To this:
```sql
-- FIXED: check user_roles table
SELECT p.org_id, p.designation_id
INTO _org_id, _designation_id
FROM profiles p WHERE p.id = _user_id;

-- Check admin status from user_roles table
IF EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = _user_id
    AND role IN ('admin', 'super_admin')
) THEN
  RETURN NULL;
END IF;
```

No frontend changes needed. The existing RLS policies already handle `NULL` as "see all" -- once the function correctly identifies admins, they will see all data automatically.

