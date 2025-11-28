import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FeatureAccess {
  isFeatureEnabled: (featureKey: string) => boolean;
  hasPermission: (featureKey: string, permission: 'view' | 'create' | 'edit' | 'delete') => boolean;
  canAccessFeature: (featureKey: string) => boolean;
  loading: boolean;
}

/**
 * Feature access hook for single-tenant application
 * In single-tenant mode, features are enabled by default but designation permissions still apply
 */
export const useFeatureAccess = (): FeatureAccess => {
  // Fetch user's designation
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-designation"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("designation_id")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch designation permissions
  const { data: designationPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["designation-permissions", userProfile?.designation_id],
    queryFn: async () => {
      if (!userProfile?.designation_id) return [];
      const { data, error } = await supabase
        .from("designation_feature_access")
        .select("*")
        .eq("designation_id", userProfile.designation_id);
      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.designation_id,
  });

  const isFeatureEnabled = (featureKey: string): boolean => {
    // In single-tenant mode, all features are enabled at org level
    return true;
  };

  const hasPermission = (
    featureKey: string,
    permission: 'view' | 'create' | 'edit' | 'delete'
  ): boolean => {
    // Check designation-level permissions
    const designationPermission = designationPermissions?.find(
      p => p.feature_key === featureKey
    );
    
    if (!designationPermission) return true; // Default: allow if not restricted
    
    const permissionMap = {
      view: designationPermission.can_view,
      create: designationPermission.can_create,
      edit: designationPermission.can_edit,
      delete: designationPermission.can_delete,
    };
    
    return permissionMap[permission] ?? false;
  };

  const canAccessFeature = (featureKey: string): boolean => {
    return isFeatureEnabled(featureKey) && hasPermission(featureKey, 'view');
  };

  return {
    isFeatureEnabled,
    hasPermission,
    canAccessFeature,
    loading: profileLoading || permissionsLoading,
  };
};
