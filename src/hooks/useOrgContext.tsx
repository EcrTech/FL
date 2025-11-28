import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const ORG_CONTEXT_CACHE_KEY = "org_context_cache";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

interface CachedOrgContext {
  userOrgId: string;
  isPlatformAdmin: boolean;
  timestamp: number;
}

/**
 * Organization context hook for multi-tenant applications
 * 
 * Manages user's organization context, platform admin status, and impersonation.
 * Automatically listens for context changes via storage and custom events.
 * Uses localStorage caching with 1-hour TTL to reduce database queries.
 * 
 * @returns Organization context state
 * @property {string | null} userOrgId - User's actual organization ID
 * @property {string | null} effectiveOrgId - Active org ID (considers impersonation)
 * @property {boolean | null} isPlatformAdmin - Whether user has platform admin privileges
 * @property {boolean} isImpersonating - Whether admin is impersonating another org
 * @property {boolean} isLoading - Loading state during context initialization
 * 
 * @example
 * ```tsx
 * const { effectiveOrgId, isPlatformAdmin } = useOrgContext();
 * if (!effectiveOrgId) return <LoadingState />;
 * ```
 * 
 * @see {@link setImpersonation} For admin impersonation
 * @see {@link clearImpersonation} To exit impersonation mode
 */
export function useOrgContext() {
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [effectiveOrgId, setEffectiveOrgId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadOrgContext = async () => {
      // Prevent multiple simultaneous loads
      if (isLoadingRef.current) {
        console.log('[useOrgContext] Already loading, skipping...');
        return;
      }
      
      isLoadingRef.current = true;
      
      // Only update state if component is still mounted
      if (isMounted) {
        setIsLoading(true);
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (isMounted) {
          setIsLoading(false);
        }
        isLoadingRef.current = false;
        return;
      }
      
      console.log('[useOrgContext] Loading org context for user:', user.id);

      // Try to get cached org context
      let profile: { org_id: string; is_platform_admin: boolean } | null = null;
      const cached = localStorage.getItem(ORG_CONTEXT_CACHE_KEY);
      
      if (cached) {
        try {
          const cachedData: CachedOrgContext = JSON.parse(cached);
          const now = Date.now();
          
          // Use cache if it's still valid (within TTL)
          if (now - cachedData.timestamp < CACHE_TTL) {
            profile = {
              org_id: cachedData.userOrgId,
              is_platform_admin: cachedData.isPlatformAdmin
            };
          }
        } catch (e) {
          // Invalid cache, will fetch from database
          localStorage.removeItem(ORG_CONTEXT_CACHE_KEY);
        }
      }

      // Fetch from database if no valid cache
      if (!profile) {
        const { data } = await supabase
          .from("profiles")
          .select("org_id, is_platform_admin")
          .eq("id", user.id)
          .single();
        
        profile = data;
        
        // Cache the result
        if (profile) {
          const cacheData: CachedOrgContext = {
            userOrgId: profile.org_id,
            isPlatformAdmin: profile.is_platform_admin || false,
            timestamp: Date.now()
          };
          localStorage.setItem(ORG_CONTEXT_CACHE_KEY, JSON.stringify(cacheData));
        }
      }

      if (profile && isMounted) {
        setUserOrgId(profile.org_id);
        setIsPlatformAdmin(profile.is_platform_admin || false);

        // Check for impersonation
        const impersonationData = sessionStorage.getItem("platform_admin_impersonation");
        let finalOrgId: string;
        let isImpersonatingOrg = false;
        
        if (impersonationData && profile.is_platform_admin) {
          const { org_id } = JSON.parse(impersonationData);
          finalOrgId = org_id;
          isImpersonatingOrg = true;
          setEffectiveOrgId(org_id);
          setIsImpersonating(true);
        } else {
          finalOrgId = profile.org_id;
          isImpersonatingOrg = false;
          setEffectiveOrgId(profile.org_id);
          setIsImpersonating(false);
        }
        
        // Enhanced debugging logs
        console.log('=== ORG CONTEXT RESOLVED ===');
        console.log('userOrgId:', profile.org_id);
        console.log('isPlatformAdmin:', profile.is_platform_admin);
        console.log('impersonationData:', impersonationData);
        console.log('effectiveOrgId (final):', finalOrgId);
        console.log('isImpersonating:', isImpersonatingOrg);
        console.log('=== ORG CONTEXT END ===');
      }
      
      if (isMounted) {
        setIsLoading(false);
      }
      isLoadingRef.current = false;
    };

    loadOrgContext();

    // Debounce timer for org context changes
    let debounceTimer: NodeJS.Timeout | null = null;
    
    // Listen for custom events for org context changes
    const handleOrgContextChange = () => {
      console.log('[useOrgContext] Org context change event received');
      
      // Debounce rapid-fire events
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(() => {
        // Clear cache and loading ref on context change
        localStorage.removeItem(ORG_CONTEXT_CACHE_KEY);
        isLoadingRef.current = false;
        loadOrgContext();
      }, 100); // 100ms debounce
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Clear cache on login/token refresh
        localStorage.removeItem(ORG_CONTEXT_CACHE_KEY);
        loadOrgContext();
      } else if (event === 'SIGNED_OUT') {
        // Clear cache on logout
        localStorage.removeItem(ORG_CONTEXT_CACHE_KEY);
        setUserOrgId(null);
        setEffectiveOrgId(null);
        setIsPlatformAdmin(null);
        setIsImpersonating(false);
      }
    });

    window.addEventListener("orgContextChange", handleOrgContextChange);

    return () => {
      isMounted = false;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      window.removeEventListener("orgContextChange", handleOrgContextChange);
      subscription.unsubscribe();
    };
  }, []);

  return {
    userOrgId,
    effectiveOrgId,
    isPlatformAdmin,
    isImpersonating,
    isLoading,
  };
}
