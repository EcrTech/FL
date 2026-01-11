import { useAuth } from "@/contexts/AuthContext";

/**
 * Organization context hook for single-tenant application
 * 
 * Now uses the centralized AuthContext to prevent duplicate API calls.
 * All users belong to the same organization.
 * 
 * @returns Organization context state
 * @property {string | null} orgId - The organization ID
 * @property {boolean} isLoading - Loading state during context initialization
 * @property {string | null} error - Error message if profile/org loading failed
 * 
 * @example
 * ```tsx
 * const { orgId, isLoading, error } = useOrgContext();
 * if (error) return <ErrorState message={error} />;
 * if (!orgId) return <LoadingState />;
 * ```
 */
export function useOrgContext() {
  const { orgId, isLoading, profileError } = useAuth();
  
  return {
    orgId,
    isLoading,
    error: profileError,
  };
}
