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
 * 
 * @example
 * ```tsx
 * const { orgId, isLoading } = useOrgContext();
 * if (!orgId) return <LoadingState />;
 * ```
 */
export function useOrgContext() {
  const { orgId, isLoading } = useAuth();
  
  return {
    orgId,
    isLoading,
  };
}
