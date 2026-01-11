import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

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
    // Prevent concurrent fetch calls
    if (fetchInProgressRef.current) {
      console.log("[AuthContext] Fetch already in progress, skipping");
      return;
    }
    fetchInProgressRef.current = true;

    try {
      setProfileError(null);
      
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

      // Set user role
      if (roleRes.data) {
        setUserRole(roleRes.data.role);
      }

      // Handle profile fetch errors
      if (profileRes.error) {
        console.error("[AuthContext] Profile fetch error:", profileRes.error);
        setProfileError("Failed to load your profile. Please try refreshing the page.");
        return;
      }

      if (!profileRes.data) {
        console.error("[AuthContext] No profile found for user:", currentUser.id);
        setProfileError("Profile not found. Please contact support.");
        return;
      }

      // Set profile
      setProfile(profileRes.data);

      if (!profileRes.data.org_id) {
        console.error("[AuthContext] User has no org_id:", currentUser.id);
        setProfileError("Your account is not linked to an organization. Please contact support.");
        return;
      }

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

      if (orgRes.error) {
        console.error("[AuthContext] Organization fetch error:", orgRes.error);
      } else if (orgRes.data) {
        setOrganization(orgRes.data);
      }

      if (permissionsRes.data) {
        setDesignationPermissions(permissionsRes.data);
      }
    } catch (error) {
      console.error("[AuthContext] Error fetching user data:", error);
      setProfileError("An error occurred while loading your account. Please try again.");
    } finally {
      fetchInProgressRef.current = false;
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        await fetchUserData(currentSession.user);
      }
    } catch (error) {
      console.error("Error refreshing auth:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserData]);

  useEffect(() => {
    let mounted = true;
    isInitializingRef.current = true;

    // Initialize auth on mount
    const initAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
        }
        
        if (!mounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchUserData(currentSession.user);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        if (mounted) {
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
        if (!mounted) return;
        
        // Skip if still initializing - initAuth handles the initial state
        // Using ref to properly check across async boundaries
        if (isInitializingRef.current) {
          console.log("[AuthContext] Still initializing, skipping auth state change");
          return;
        }
        
        try {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          
          if (event === 'SIGNED_IN' && currentSession?.user) {
            setIsLoading(true);
            await fetchUserData(currentSession.user);
            setIsLoading(false);
          } else if (event === 'SIGNED_OUT') {
            setProfile(null);
            setOrganization(null);
            setUserRole(null);
            setDesignationPermissions([]);
          }
        } catch (error) {
          console.error("Error handling auth state change:", error);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
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
