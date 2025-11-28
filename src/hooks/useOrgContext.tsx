import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Organization context hook for single-tenant application
 * 
 * Provides the single organization ID for all operations.
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
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const loadOrgContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      // Fetch user's org_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (profile && isMounted) {
        setOrgId(profile.org_id);
      }
      
      if (isMounted) {
        setIsLoading(false);
      }
    };

    loadOrgContext();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadOrgContext();
      } else if (event === 'SIGNED_OUT') {
        setOrgId(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    orgId,
    isLoading,
  };
}
