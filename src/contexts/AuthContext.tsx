import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

console.log('[AuthContext] Module loading...');

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  org_id: string;
  designation_id: string | null;
  onboarding_completed: boolean;
}

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
}

interface DesignationPermission {
  feature_key: string;
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
  custom_permissions: unknown;
}

interface AuthContextType {
  // Auth state
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  
  // Profile data
  profile: UserProfile | null;
  orgId: string | null;
  userName: string;
  
  // Organization data
  organization: Organization | null;
  orgLogo: string;
  orgName: string;
  
  // Role & permissions
  userRole: string | null;
  isAdmin: boolean;
  isManager: boolean;
  designationPermissions: DesignationPermission[];
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Error state
  profileError: string | null;
  
  // Permission helpers
  hasPermission: (featureKey: string, permission: 'view' | 'create' | 'edit' | 'delete') => boolean;
  canAccessFeature: (featureKey: string) => boolean;
  
  // Actions
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  console.log('[AuthProvider] Component rendering...');
  
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [designationPermissions, setDesignationPermissions] = useState<DesignationPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Refs to properly guard async operations across renders
  const isInitializingRef = useRef(true);
  const fetchInProgressRef = useRef(false);

  const fetchUserData = useCallback(async (currentUser: User) => {
    console.log('[AuthProvider] fetchUserData called for user:', currentUser.id);
    
    // Prevent concurrent fetch calls
    if (fetchInProgressRef.current) {
      console.log("[AuthProvider] Fetch already in progress, skipping");
      return;
    }
    fetchInProgressRef.current = true;

    try {
      setProfileError(null);
      
      console.log('[AuthProvider] Fetching role and profile in parallel...');
      
      // Fetch all user data in parallel - single batch of requests
      const [roleRes, profileRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, org_id, designation_id, onboarding_completed")
          .eq("id", currentUser.id)
          .single()
      ]);

      console.log('[AuthProvider] Role result:', roleRes.data, 'Error:', roleRes.error);
      console.log('[AuthProvider] Profile result:', profileRes.data ? 'Found' : 'Not found', 'Error:', profileRes.error);

      // Set user role
      if (roleRes.data) {
        setUserRole(roleRes.data.role);
      }

      // Handle profile fetch errors
      if (profileRes.error) {
        console.error("[AuthProvider] Profile fetch error:", profileRes.error);
        setProfileError("Failed to load your profile. Please try refreshing the page.");
        return;
      }

      if (!profileRes.data) {
        console.error("[AuthProvider] No profile found for user:", currentUser.id);
        setProfileError("Profile not found. Please contact support.");
        return;
      }

      // Set profile
      setProfile(profileRes.data);
      console.log('[AuthProvider] Profile set, org_id:', profileRes.data.org_id);

      if (!profileRes.data.org_id) {
        console.error("[AuthProvider] User has no org_id:", currentUser.id);
        setProfileError("Your account is not linked to an organization. Please contact support.");
        return;
      }

      console.log('[AuthProvider] Fetching org data and permissions in parallel...');
      
      // Fetch org data and designation permissions in parallel
      const orgPromise = supabase
        .from("organizations")
        .select("id, name, logo_url")
        .eq("id", profileRes.data.org_id)
        .single();

      const permissionsPromise = profileRes.data.designation_id
        ? supabase
            .from("designation_feature_access")
            .select("feature_key, can_view, can_create, can_edit, can_delete, custom_permissions")
            .eq("designation_id", profileRes.data.designation_id)
        : Promise.resolve({ data: [], error: null });

      const [orgRes, permissionsRes] = await Promise.all([orgPromise, permissionsPromise]);

      console.log('[AuthProvider] Org result:', orgRes.data ? 'Found' : 'Not found', 'Error:', orgRes.error);
      console.log('[AuthProvider] Permissions count:', permissionsRes.data?.length || 0);

      if (orgRes.error) {
        console.error("[AuthProvider] Organization fetch error:", orgRes.error);
      } else if (orgRes.data) {
        setOrganization(orgRes.data);
      }

      if (permissionsRes.data) {
        setDesignationPermissions(permissionsRes.data);
      }
      
      console.log('[AuthProvider] fetchUserData completed successfully');
    } catch (error) {
      console.error("[AuthProvider] Error fetching user data:", error);
      setProfileError("An error occurred while loading your account. Please try again.");
    } finally {
      fetchInProgressRef.current = false;
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    console.log('[AuthProvider] refreshAuth called');
    setIsLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        await fetchUserData(currentSession.user);
      }
    } catch (error) {
      console.error("[AuthProvider] Error refreshing auth:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserData]);

  useEffect(() => {
    console.log('[AuthProvider] useEffect starting - initializing auth...');
    let mounted = true;
    isInitializingRef.current = true;

    // Initialize auth on mount
    const initAuth = async () => {
      console.log('[AuthProvider] initAuth called');
      try {
        console.log('[AuthProvider] Fetching initial session...');
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("[AuthProvider] Error getting session:", error);
        }
        
        console.log('[AuthProvider] Initial session:', currentSession ? 'Exists' : 'None');
        
        if (!mounted) {
          console.log('[AuthProvider] Component unmounted, aborting initAuth');
          return;
        }
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          console.log('[AuthProvider] Session found, fetching user data...');
          await fetchUserData(currentSession.user);
        } else {
          console.log('[AuthProvider] No session, skipping user data fetch');
        }
      } catch (error) {
        console.error("[AuthProvider] Error initializing auth:", error);
      } finally {
        if (mounted) {
          console.log('[AuthProvider] initAuth complete, setting isInitialized=true');
          isInitializingRef.current = false;
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initAuth();

    // Set up auth state change listener for subsequent auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[AuthProvider] onAuthStateChange:', event, currentSession ? 'Session exists' : 'No session');
        
        if (!mounted) return;
        
        // Skip if still initializing - initAuth handles the initial state
        // Using ref to properly check across async boundaries
        if (isInitializingRef.current) {
          console.log("[AuthProvider] Still initializing, skipping auth state change");
          return;
        }
        
        try {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          
          if (event === 'SIGNED_IN' && currentSession?.user) {
            console.log('[AuthProvider] SIGNED_IN event');
            // Only set loading and fetch if not already in progress
            if (!fetchInProgressRef.current) {
              console.log('[AuthProvider] Starting user data fetch...');
              setIsLoading(true);
              await fetchUserData(currentSession.user);
              setIsLoading(false);
            } else {
              console.log('[AuthProvider] Fetch already in progress, waiting for initAuth to complete');
            }
          } else if (event === 'SIGNED_OUT') {
            console.log('[AuthProvider] SIGNED_OUT event, clearing state');
            setProfile(null);
            setOrganization(null);
            setUserRole(null);
            setDesignationPermissions([]);
          }
        } catch (error) {
          console.error("[AuthProvider] Error handling auth state change:", error);
          setIsLoading(false);
        }
      }
    );

    return () => {
      console.log('[AuthProvider] Cleanup - unmounting');
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    console.log('[AuthProvider] signOut called');
    await supabase.auth.signOut();
  }, []);

  const hasPermission = useCallback((featureKey: string, permission: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    const designationPermission = designationPermissions.find(
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
  }, [designationPermissions]);

  const canAccessFeature = useCallback((featureKey: string): boolean => {
    // In single-tenant mode, all features are enabled at org level
    // Just check designation permission for view
    return hasPermission(featureKey, 'view');
  }, [hasPermission]);

  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isManager = isAdmin || userRole === "sales_manager" || userRole === "support_manager";

  const value: AuthContextType = {
    session,
    user,
    isAuthenticated: !!session?.user,
    profile,
    orgId: profile?.org_id ?? null,
    userName: profile ? `${profile.first_name} ${profile.last_name}` : "",
    organization,
    orgLogo: organization?.logo_url ?? "",
    orgName: organization?.name ?? "",
    userRole,
    isAdmin,
    isManager,
    designationPermissions,
    isLoading,
    isInitialized,
    profileError,
    hasPermission,
    canAccessFeature,
    signOut,
    refreshAuth,
  };

  console.log('[AuthProvider] Rendering with state:', {
    isLoading,
    isInitialized,
    hasSession: !!session,
    hasUser: !!user,
    hasProfile: !!profile,
    userRole,
    profileError
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Simplified hooks that consume from auth context
export function useOrgId() {
  const { orgId, isLoading } = useAuth();
  return { orgId, isLoading };
}

export function useUserRole() {
  const { userRole, isAdmin, isManager, isLoading } = useAuth();
  return { userRole, isAdmin, isManager, isLoading };
}
