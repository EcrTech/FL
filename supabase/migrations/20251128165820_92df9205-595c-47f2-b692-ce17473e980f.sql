-- Phase 1: Single-Tenant Conversion Migration (Fixed)

-- Step 1: Create default organization if it doesn't exist
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  SELECT id INTO default_org_id FROM organizations LIMIT 1;
  
  IF default_org_id IS NULL THEN
    INSERT INTO organizations (name, slug, services_enabled)
    VALUES ('Default Organization', 'default-org', true)
    RETURNING id INTO default_org_id;
    RAISE NOTICE 'Created default organization with ID: %', default_org_id;
  ELSE
    RAISE NOTICE 'Using existing organization with ID: %', default_org_id;
  END IF;
  
  -- Update all users to belong to the default org
  UPDATE profiles
  SET org_id = default_org_id,
      is_platform_admin = false
  WHERE org_id IS NULL OR is_platform_admin = true;
  
  -- Ensure all users have a role in the default org
  INSERT INTO user_roles (user_id, org_id, role)
  SELECT p.id, default_org_id, COALESCE(ur.role, 'sales_agent'::app_role)
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur2 
    WHERE ur2.user_id = p.id AND ur2.org_id = default_org_id
  )
  ON CONFLICT (user_id, org_id) DO NOTHING;
END $$;

-- Step 2: Drop all RLS policies that depend on is_platform_admin()
DROP POLICY IF EXISTS "Admins can manage roles in their org" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can manage all invoices" ON subscription_invoices;
DROP POLICY IF EXISTS "Platform admins can manage all subscriptions" ON organization_subscriptions;
DROP POLICY IF EXISTS "Platform admins can manage audit log" ON subscription_audit_log;
DROP POLICY IF EXISTS "Platform admins can manage designation feature access" ON designation_feature_access;
DROP POLICY IF EXISTS "Platform admins can manage feature permissions" ON feature_permissions;
DROP POLICY IF EXISTS "Platform admins can manage org feature access" ON org_feature_access;
DROP POLICY IF EXISTS "Platform admins can manage pricing" ON subscription_pricing;
DROP POLICY IF EXISTS "Platform admins can manage wallet transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Platform admins can update all organizations" ON organizations;
DROP POLICY IF EXISTS "Platform admins can view all error logs" ON error_logs;
DROP POLICY IF EXISTS "Platform admins can view all notifications" ON subscription_notifications;
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Platform admins can view all transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Platform admins can view all usage" ON service_usage_logs;
DROP POLICY IF EXISTS "Platform admins can view all user roles" ON user_roles;

-- Step 3: Recreate simplified policies for single-tenant (admins only)
CREATE POLICY "Admins can manage roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Step 4: Drop platform admin and multi-tenant functions
DROP FUNCTION IF EXISTS public.is_platform_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_platform_admin_stats() CASCADE;

-- Step 5: Drop multi-tenant tables
DROP TABLE IF EXISTS public.org_invites CASCADE;
DROP TABLE IF EXISTS public.platform_admin_audit_log CASCADE;
DROP TABLE IF EXISTS public.org_feature_access CASCADE;

-- Step 6: Remove is_platform_admin column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_platform_admin;

-- Step 7: Ensure default organization has a subscription
DO $$
DECLARE
  default_org_id UUID;
  sub_exists BOOLEAN;
BEGIN
  SELECT id INTO default_org_id FROM organizations LIMIT 1;
  
  SELECT EXISTS(
    SELECT 1 FROM organization_subscriptions WHERE org_id = default_org_id
  ) INTO sub_exists;
  
  IF NOT sub_exists THEN
    INSERT INTO organization_subscriptions (
      org_id, subscription_status, billing_cycle_start, next_billing_date,
      user_count, monthly_subscription_amount, wallet_balance,
      wallet_minimum_balance, wallet_auto_topup_enabled
    ) VALUES (
      default_org_id, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month',
      1, 500, 10000, 5000, true
    );
  END IF;
END $$;