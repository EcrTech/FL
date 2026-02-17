
# Auto-Assign Leads Created by Team Members

## Problem
When a team member (non-admin) creates a lead or contact, the `assigned_to` field may be left empty depending on the creation path. This means the lead could appear as "unassigned" and -- with the recent RLS change -- become invisible to the creator themselves.

## Solution
Create a database trigger on both `contacts` and `loan_applications` tables that automatically sets `assigned_to = created_by` when:
- A new record is inserted
- `assigned_to` is NULL (no explicit assignment was made)
- `created_by` is NOT NULL
- The creator is NOT an admin or super_admin (admins may intentionally leave leads unassigned)

This runs at the database level, so it works regardless of how the lead is created -- manual form, bulk upload (for rows without assignment), edge functions, etc.

## Technical Details

### Database Migration
A single migration with a trigger function and two triggers:

**Function: `auto_assign_to_creator()`**
- Runs BEFORE INSERT on both tables
- Checks if `NEW.assigned_to IS NULL` and `NEW.created_by IS NOT NULL`
- Looks up whether the creator has an `admin` or `super_admin` role in `user_roles`
- If the creator is a regular member (not admin), sets `NEW.assigned_to = NEW.created_by`
- Admins keep the lead unassigned (they manage the assignment pool)

**Triggers:**
- `auto_assign_contact_to_creator` on `contacts` (BEFORE INSERT)
- `auto_assign_loan_app_to_creator` on `loan_applications` (BEFORE INSERT)

### No Frontend Changes Required
The trigger handles assignment transparently at the database level. The existing forms and edge functions continue to work as-is -- they just won't produce unassigned leads for non-admin users anymore.
