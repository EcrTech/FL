import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import {
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  Contact,
  GitBranch,
  BarChart3,
  Network,
  UserCog,
  TrendingUp,
  Lightbulb,
  UsersRound,
  Layers,
  PhoneCall,
  Package,
  CheckSquare,
  Award,
  FileText,
  List,
  Sliders,
  Building2,
  Webhook,
  MessageSquare,
  Mail,
  Send,
  Database,
  CreditCard,
  Activity,
  Key,
  Star,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { OnboardingDialog } from "@/components/Onboarding/OnboardingDialog";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useModuleTracking } from "@/hooks/useModuleTracking";
import { NotificationBell } from "./NotificationBell";
import { QuickDial } from "@/components/Contact/QuickDial";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const notify = useNotification();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [orgLogo, setOrgLogo] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [orgName, setOrgName] = useState<string>("");
  const { canAccessFeature, loading: featureAccessLoading } = useFeatureAccess();
  
  // Track module usage
  useModuleTracking();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // PERFORMANCE: Batch all queries together
      const [roleRes, profileRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("profiles")
          .select("first_name, last_name, org_id, onboarding_completed")
          .eq("id", user.id)
          .single()
      ]);

      if (roleRes.data) {
        setUserRole(roleRes.data.role);
      }

      if (profileRes.data) {
        setUserName(`${profileRes.data.first_name} ${profileRes.data.last_name}`);
        
        // Check if user needs onboarding
        if (!profileRes.data.onboarding_completed && roleRes.data?.role) {
          setShowOnboarding(true);
        }
        setOnboardingChecked(true);
        
        // Get organization logo and name (only if org_id exists)
        if (profileRes.data.org_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("logo_url, name")
            .eq("id", profileRes.data.org_id)
            .single();
          
          if (orgData?.logo_url) {
            setOrgLogo(orgData.logo_url);
          }
          if (orgData?.name) {
            setOrgName(orgData.name);
          }
        }
      }
    };

    fetchUserData();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    notify.success("Signed out", "You've been successfully signed out");
    navigate("/login");
  };

  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isManager = userRole === "admin" || userRole === "super_admin" || userRole === "sales_manager" || userRole === "support_manager";

  // Check if sections should be visible
  const showDashboardsSection = canAccessFeature("analytics") || canAccessFeature("calling") || 
    canAccessFeature("campaigns_email") || canAccessFeature("campaigns_whatsapp") || canAccessFeature("ai_insights");
  
  const showOperationsSection = canAccessFeature("campaigns_email") || canAccessFeature("contacts") || 
    canAccessFeature("pipeline_stages") || canAccessFeature("calling") || canAccessFeature("redefine_data_repository");
  
  const showAdminCommunicationSection = isAdmin && (
    canAccessFeature("campaigns_whatsapp") || 
    canAccessFeature("email_settings") ||
    canAccessFeature("calling") || 
    canAccessFeature("templates")
  );
  
  const showManagementSection = isAdmin && (
    canAccessFeature("users") || 
    canAccessFeature("teams") || 
    canAccessFeature("designations") || 
    canAccessFeature("approval_matrix")
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <img src={orgLogo || logo} alt="Logo" className="h-12 object-contain" />
        <div className="flex items-center gap-2">
          <QuickDial />
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky inset-y-0 left-0 z-50 lg:top-0 lg:h-screen
            w-64 bg-card border-r border-border
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <div className="h-full lg:h-screen flex flex-col overflow-y-auto">
            {/* Logo */}
            <div className="p-6 border-b border-border flex flex-col items-center bg-gradient-to-br from-primary/5 to-transparent">
              <img src={orgLogo || logo} alt="Logo" className="h-16 object-contain mb-3" />
              <p className="text-sm font-medium text-foreground text-center">{userName}</p>
              <div className="mt-4 w-full">
                <QuickDial />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {/* Dashboards & Reports Section */}
              {showDashboardsSection && (
                <div className="pb-2 section-accent-teal pl-4">
                  <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                    Dashboards & Reports
                  </p>
                </div>
              )}
              
              {/* LOS Dashboard */}
              <Link
                to="/los/dashboard"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                onClick={() => setSidebarOpen(false)}
              >
                <Activity size={20} />
                <span>LOS Dashboard</span>
              </Link>

              {(canAccessFeature("analytics") || canAccessFeature("campaigns_email") || canAccessFeature("campaigns_whatsapp") || canAccessFeature("ai_insights")) && (
                <Link
                  to="/reports"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <TrendingUp size={20} />
                  <span>Analytics & Insights</span>
                </Link>
              )}

              {canAccessFeature("calling") && (
                <Link
                  to="/calling-dashboard"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <PhoneCall size={20} />
                  <span>Calling Dashboard</span>
                </Link>
              )}


              {/* Sales & Operations Section */}
              {showOperationsSection && (
                <div className="pt-4 pb-2 section-accent-teal pl-4">
                  <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                    Sales & Operations
                  </p>
                </div>
              )}
              
              {canAccessFeature("contacts") && (
                <Link
                  to="/contacts"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Contact size={20} />
                  <span>Contacts</span>
                </Link>
              )}

              {canAccessFeature("pipeline_stages") && (
                <Link
                  to="/pipeline"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <GitBranch size={20} />
                  <span>Leads</span>
                </Link>
              )}

              <Link
                to="/los/applications"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                onClick={() => setSidebarOpen(false)}
              >
                <FileText size={20} />
                <span>Loan Applications</span>
              </Link>

              <Link
                to="/los/approval-queue"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                onClick={() => setSidebarOpen(false)}
              >
                <List size={20} />
                <span>Approval Queue</span>
              </Link>

              <Link
                to="/tasks"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                onClick={() => setSidebarOpen(false)}
              >
                <CheckSquare size={20} />
                <span>Tasks</span>
              </Link>

              {canAccessFeature("communications") && (
                <Link
                  to="/communications"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <MessageSquare size={20} />
                  <span>Campaigns</span>
                </Link>
              )}

              {canAccessFeature("redefine_data_repository") && orgName.includes("Redefine") && (
                <Link
                  to="/redefine-repository"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Database size={20} />
                  <span>Data Repository</span>
                </Link>
              )}

              {canAccessFeature("inventory") && orgName === "C.Parekh & Co" && (
                <Link
                  to="/inventory"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Package size={20} />
                  <span>Inventory</span>
                </Link>
              )}

              {showManagementSection && (
                <>
                  <div className="pt-4 pb-2 section-accent-teal pl-4">
                    <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                      Management
                    </p>
                  </div>
                  {canAccessFeature("users") && (
                    <Link
                      to="/users"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <UserCog size={20} />
                      <span>Users</span>
                    </Link>
                  )}
                  {canAccessFeature("teams") && (
                    <Link
                      to="/teams"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <UsersRound size={20} />
                      <span>Teams</span>
                    </Link>
                  )}
                  {canAccessFeature("designations") && (
                    <Link
                      to="/admin/designations"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Award size={20} />
                      <span>Designations</span>
                    </Link>
                  )}
                  {canAccessFeature("approval_matrix") && (
                    <Link
                      to="/admin/approval-matrix"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <CheckSquare size={20} />
                      <span>Approval Matrix</span>
                    </Link>
                  )}
                </>
              )}


              {isAdmin && (
                <>
                  {showAdminCommunicationSection && (
                    <div className="pt-4 pb-2 section-accent-teal pl-4">
                      <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                        Communication Setup
                      </p>
                    </div>
                  )}
                  
                  {canAccessFeature("templates") && (
                    <Link
                      to="/templates"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <FileText size={20} />
                      <span>Templates</span>
                    </Link>
                  )}
                </>
              )}

              {isAdmin && (
                <>
                  {(canAccessFeature("connectors") || canAccessFeature("api_keys")) && (
                    <div className="pt-4 pb-2 section-accent-teal pl-4">
                      <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                        Integration & APIs
                      </p>
                    </div>
                  )}
                  
                  {canAccessFeature("connectors") && (
                    <Link
                      to="/admin/connectors"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Webhook size={20} />
                      <span>Webhook Connectors</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("connectors") && (
                    <Link
                      to="/admin/outbound-webhooks"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Send size={20} />
                      <span>Outbound Webhooks</span>
                    </Link>
                  )}
                  
                </>
              )}
            </nav>

            {/* Sign out */}
            <div className="p-4 border-t border-border">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={handleSignOut}
              >
                <LogOut size={20} className="mr-3" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Onboarding Dialog */}
      {onboardingChecked && showOnboarding && userRole && (
        <OnboardingDialog
          open={showOnboarding}
          userRole={userRole}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}

export default DashboardLayout;
export { DashboardLayout };
