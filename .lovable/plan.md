

## Change: Restrict Unassigned Leads to Admins Only

### Current Behavior
The SELECT policy on the `contacts` table shows unassigned leads (`assigned_to IS NULL`) to **all** users in the organization.

### Desired Behavior
- **Admins/Super Admins**: Can see all leads (assigned and unassigned)
- **Other users**: Can only see leads assigned to themselves or their subordinates

### Technical Details

**Single database migration** to replace the existing SELECT policy on `contacts`.

The current condition:
```
(assigned_to IS NULL) OR (assigned_to = ANY(get_visible_user_ids(...)))
```

Will be updated to:
```
-- Admins see everything (already handled by get_visible_user_ids returning all org users)
-- Non-admins: remove the "assigned_to IS NULL" fallback
(assigned_to = ANY(get_visible_user_ids(auth.uid())))
OR
(assigned_to IS NULL AND EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
))
```

This moves the `assigned_to IS NULL` check behind an admin role gate. The `get_visible_user_ids` function already returns all org user IDs for admins, so assigned leads remain fully visible to them. For non-admins, only leads assigned to them or their subordinates will appear.

No frontend changes required.

