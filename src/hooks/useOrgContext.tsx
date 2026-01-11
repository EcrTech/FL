import { ORGANIZATION_ID } from "@/config/organization";

/**
 * Organization context hook for single-tenant application
 * 
 * Returns the hardcoded organization ID immediately without any loading state.
 * This eliminates the auth → profile → org loading chain that was blocking pages.
 * 
 * @returns Organization context with immediate values
 * @property {string} orgId - The hardcoded organization ID (always available)
 * @property {boolean} isLoading - Always false (no loading needed)
 * @property {null} error - Always null (no fetch = no errors)
 */
export function useOrgContext() {
  return {
    orgId: ORGANIZATION_ID,
    isLoading: false,
    error: null,
  };
}
