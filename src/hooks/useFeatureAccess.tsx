import { useAuth } from "@/contexts/AuthContext";

interface FeatureAccess {
  isFeatureEnabled: (featureKey: string) => boolean;
  hasPermission: (featureKey: string, permission: 'view' | 'create' | 'edit' | 'delete') => boolean;
  canAccessFeature: (featureKey: string) => boolean;
  loading: boolean;
}

/**
 * Feature access hook for single-tenant application
 * Now uses the centralized AuthContext to prevent duplicate API calls.
 * In single-tenant mode, features are enabled by default but designation permissions still apply
 */
export const useFeatureAccess = (): FeatureAccess => {
  const { hasPermission, canAccessFeature, isLoading } = useAuth();

  const isFeatureEnabled = (_featureKey: string): boolean => {
    // In single-tenant mode, all features are enabled at org level
    return true;
  };

  return {
    isFeatureEnabled,
    hasPermission,
    canAccessFeature,
    loading: isLoading,
  };
};
