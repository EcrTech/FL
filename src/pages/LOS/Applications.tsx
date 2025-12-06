import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useLOSPermissions } from "@/hooks/useLOSPermissions";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye, Clock, FileText, Sparkles, UserPlus, Phone } from "lucide-react";
import { differenceInHours } from "date-fns";
import { format } from "date-fns";
import { LoadingState } from "@/components/common/LoadingState";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "in_progress", label: "In-progress" },
];

// Section tabs for lead status
const SECTIONS = [
  { id: "new", label: "New", statuses: ["new", "draft"] },
  { id: "approved", label: "Approved", statuses: ["approved"] },
  { id: "rejected", label: "Rejected", statuses: ["rejected"] },
  { id: "in_progress", label: "In-progress", statuses: ["in_progress"] },
];

const STAGE_LABELS: Record<string, string> = {
  application_login: "Application Login",
  document_collection: "Document Collection",
  field_verification: "Field Verification",
  credit_assessment: "Credit Assessment",
  approval_pending: "Approval Pending",
  approved: "Approved",
  rejected: "Rejected",
  sanction_generated: "Sanction Generated",
  disbursement_pending: "Disbursement Pending",
  disbursed: "Disbursed",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted",
  in_progress: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  disbursed: "bg-purple-500",
  new: "bg-yellow-500",
};

export default function Applications() {
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const { permissions } = useLOSPermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("new");

  const isFreshApplication = (createdAt: string) => {
    return differenceInHours(new Date(), new Date(createdAt)) < 48;
  };

  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["loan-applications", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants(first_name, last_name, phone),
          contacts(first_name, last_name, phone),
          assigned_profile:profiles!loan_applications_assigned_to_fkey(first_name, last_name),
          referrer:profiles!loan_applications_referred_by_fkey(full_name)
        `)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching loan applications:", error);
        throw error;
      }
      return data as any[];
    },
    enabled: !!orgId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: string }) => {
      const { error } = await supabase
        .from("loan_applications")
        .update({ status })
        .eq("id", appId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-applications", orgId] });
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    },
  });

  const handleStatusChange = (appId: string, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateStatusMutation.mutate({ appId, status });
  };

  const handleCall = (phone: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      toast.error("No phone number available");
    }
  };

  const getApplicantPhone = (app: any) => {
    return app.loan_applicants?.[0]?.phone || app.contacts?.phone || null;
  };

  // Get section counts
  const sectionCounts = SECTIONS.reduce((acc, section) => {
    acc[section.id] = applications.filter(app => 
      section.statuses.includes(app.status)
    ).length;
    return acc;
  }, {} as Record<string, number>);

  // Filter applications by active section
  const activeStatuses = SECTIONS.find(s => s.id === activeSection)?.statuses || [];
  
  const filteredApplications = applications.filter((app) => {
    // First filter by section statuses
    if (!activeStatuses.includes(app.status)) return false;
    
    // Then filter by search query
    const searchLower = searchQuery.toLowerCase();
    if (!searchLower) return true;
    
    const applicant = app.loan_applicants?.[0];
    const applicantName = applicant
      ? `${applicant.first_name || ""} ${applicant.last_name || ""}`.toLowerCase()
      : "";
    const contactName = app.contacts
      ? `${app.contacts.first_name} ${app.contacts.last_name || ""}`.toLowerCase()
      : "";
    return (
      (app.application_number || "").toLowerCase().includes(searchLower) ||
      applicantName.includes(searchLower) ||
      contactName.includes(searchLower)
    );
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading applications..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Loan Applications</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track all loan applications
            </p>
          </div>
          {permissions.canCreateApplication && (
            <Button onClick={() => navigate("/los/applications/new")}>
              <Plus className="mr-2 h-4 w-4" />
              New Application
            </Button>
          )}
        </div>

        {/* Section Tabs */}
        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            {SECTIONS.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                {section.label}
                {sectionCounts[section.id] > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {sectionCounts[section.id]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Search */}
          <div className="pt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by application number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Applications List */}
          <Card>
            <CardHeader>
              <CardTitle>{SECTIONS.find(s => s.id === activeSection)?.label} Applications</CardTitle>
              <CardDescription>
                {filteredApplications.length} application{filteredApplications.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredApplications.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No applications in this section</h3>
                  <p className="text-muted-foreground mb-4">
                    Applications will appear here as they progress through the workflow
                  </p>
                  {activeSection === "new" && (
                    <Button onClick={() => navigate("/los/applications/new")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Application
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredApplications.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/los/applications/${app.id}`)}
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono font-semibold">
                            {app.application_number}
                          </span>
                          {app.status === "new" || isFreshApplication(app.created_at) ? (
                            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                              <Sparkles className="h-3 w-3 mr-1" />
                              NEW LEAD
                            </Badge>
                          ) : (
                            <Badge className={STATUS_COLORS[app.status] || "bg-muted"}>
                              {app.status.replace("_", " ").toUpperCase()}
                            </Badge>
                          )}
                          <Badge variant="outline">
                            {STAGE_LABELS[app.current_stage] || app.current_stage}
                          </Badge>
                          {app.source === "referral_link" && (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              <UserPlus className="h-3 w-3 mr-1" />
                              Referral
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-2 md:grid-cols-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Applicant: </span>
                            {app.loan_applicants?.[0]
                              ? `${app.loan_applicants[0].first_name} ${app.loan_applicants[0].last_name || ""}`
                              : app.contacts
                                ? `${app.contacts.first_name} ${app.contacts.last_name || ""}`
                                : "Not linked"}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
                              onClick={(e) => handleCall(getApplicantPhone(app), e)}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          </div>
                          <div>
                            <span className="font-medium">Amount: </span>
                            {formatCurrency(app.requested_amount)}
                          </div>
                          <div>
                            <span className="font-medium">Tenure: </span>
                            {app.tenure_months} months
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(app.created_at), "MMM dd, yyyy")}
                          </div>
                          {(app as any).assigned_profile && (
                            <div>
                              Assigned to: {(app as any).assigned_profile.first_name} {(app as any).assigned_profile.last_name}
                            </div>
                          )}
                          {(app as any).referrer?.full_name && (
                            <div className="text-blue-600">
                              Referred by: {(app as any).referrer.full_name}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={app.status}
                          onValueChange={(value) => handleStatusChange(app.id, value, { stopPropagation: () => {} } as any)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Set status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
