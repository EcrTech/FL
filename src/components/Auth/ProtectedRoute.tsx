import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "super_admin" | "admin" | "sales_manager" | "sales_agent" | "support_manager" | "support_agent" | "analyst";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, user, userRole, isLoading, isInitialized } = useAuth();

  console.log('[ProtectedRoute] Checking auth:', {
    isInitialized,
    isLoading,
    hasSession: !!session,
    hasUser: !!user,
    userRole,
    requiredRole
  });

  // Show loading while auth is initializing
  if (!isInitialized || isLoading) {
    console.log('[ProtectedRoute] Showing loading spinner - isInitialized:', isInitialized, 'isLoading:', isLoading);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!session || !user) {
    console.log("[ProtectedRoute] No auth, redirecting to login");
    return <Navigate to="/" replace />;
  }

  // Check role if required
  if (requiredRole) {
    // Super admin has access to everything
    if (userRole === "super_admin") {
      console.log('[ProtectedRoute] Super admin access granted');
      return <>{children}</>;
    }
    
    // Check if user has the required role
    if (userRole !== requiredRole) {
      console.log("[ProtectedRoute] Access denied for role:", userRole, "required:", requiredRole);
      return <Navigate to="/dashboard" replace />;
    }
  }

  console.log('[ProtectedRoute] Auth passed, rendering children');
  return <>{children}</>;
}
