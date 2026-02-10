

## Fix: Allow Admins to Create Users

### The Problem
The `profiles` table has an INSERT policy that only allows users to insert their own profile (`id = auth.uid()`). When an admin creates a new user, the inserted profile has a different `id`, so the INSERT is blocked by Row-Level Security.

### The Fix
Add a new INSERT policy on the `profiles` table that allows authenticated users with `admin` or `super_admin` roles to insert profiles for any user.

### Technical Details

**Single database migration** to add the policy:

```sql
CREATE POLICY "Admins can create users"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);
```

Additionally, add an UPDATE policy so admins can also edit other users' profiles:

```sql
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);
```

### What Changes
- Admins and Super Admins will be able to create new user profiles
- Admins and Super Admins will be able to update any user's profile
- Regular users retain existing permissions (can only insert/update their own profile)
- No frontend code changes needed

