import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "super_admin" | "admin" | "sales_manager" | "sales_agent" | "support_manager" | "support_agent" | "analyst";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, user, userRole, isLoading, isInitialized } = useAuth();

  // Show loading while auth is initializing
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!session || !user) {
    console.log("ProtectedRoute - Redirecting to login");
    return <Navigate to="/" replace />;
  }

  // Check role if required
  if (requiredRole) {
    // Super admin has access to everything
    if (userRole === "super_admin") {
      return <>{children}</>;
    }
    
    // Check if user has the required role
    if (userRole !== requiredRole) {
      console.log("ProtectedRoute - Access denied, redirecting to dashboard");
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
