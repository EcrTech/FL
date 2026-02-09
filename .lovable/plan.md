

## Restrict Leads Visibility to Assigned User and Hierarchy

### What This Does
Leads across all views (Pipeline Board, Contacts, Calling Leads) will only be visible to:
- The **assigned user** themselves
- **Managers above** in the reporting hierarchy (e.g., a CEO sees everything, a Project Manager sees their own + Credit Manager's leads)
- **Admins and Super Admins** always see all leads (full access)
- Unassigned leads remain visible to all users in the org

### How Hierarchy Works

```text
CEO (sees all)
├── Credit Head (sees own leads)
├── Business Manager (sees own leads)
└── Project Manager (sees own + Credit Manager's leads)
    └── Credit Manager (sees own leads only)
```

A manager can see leads assigned to anyone with a subordinate designation in the reporting hierarchy.

### Technical Details

**Step 1: Create a database function `get_visible_user_ids()`**

A new `SECURITY DEFINER` function that, given a user ID:
1. Looks up the user's designation from `profiles`
2. Uses the existing `get_subordinates()` function to find all subordinate designation IDs
3. Returns all user IDs (from `profiles`) whose designation matches either the user's own designation or any subordinate designation
4. Returns NULL for admins/super_admins (signaling "see all")

**Step 2: Update RLS policy on `contacts` table**

Replace the current SELECT policy ("Users can view contacts in their org") with a new one that checks:
- User is admin/super_admin → see all in org
- Contact has no `assigned_to` → visible to all in org  
- Contact's `assigned_to` is in the user's visible user IDs list (self + subordinates)

**Step 3: Update RLS policy on `loan_applications` table**

Replace the current SELECT policy ("Users can view loan applications in their org") with the same hierarchy-based logic using `assigned_to`.

**Step 4: No frontend code changes needed**

Since this is enforced at the database (RLS) level, all existing queries in PipelineBoard, Contacts, CallingLeads, and any other page automatically respect the restriction. Admin users continue to see everything.

### Important Notes
- This affects the **test environment** only. You'll need to publish to apply it to production.
- Leads with no `assigned_to` value remain visible to everyone in the org (so they can be claimed/assigned).
- The existing `get_subordinates()` database function is reused -- no duplication.
