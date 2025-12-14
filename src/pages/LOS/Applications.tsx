import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useLOSPermissions } from "@/hooks/useLOSPermissions";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye, Clock, FileText, Sparkles, UserPlus, Filter } from "lucide-react";
import { differenceInHours } from "date-fns";
import { format } from "date-fns";
import { LoadingState } from "@/components/common/LoadingState";

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

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "disbursed", label: "Disbursed" },
];

const STAGE_OPTIONS = [
  { value: "all", label: "All Stages" },
  { value: "application_login", label: "Application Login" },
  { value: "document_collection", label: "Document Collection" },
  { value: "field_verification", label: "Field Verification" },
  { value: "credit_assessment", label: "Credit Assessment" },
  { value: "approval_pending", label: "Approval Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "sanction_generated", label: "Sanction Generated" },
  { value: "disbursement_pending", label: "Disbursement Pending" },
  { value: "disbursed", label: "Disbursed" },
  { value: "closed", label: "Closed" },
];

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const isFreshApplication = (createdAt: string) => {
    return differenceInHours(new Date(), new Date(createdAt)) < 48;
  };

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["loan-applications", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants(first_name, last_name, mobile),
          contacts(first_name, last_name, phone),
          assigned_profile:profiles!loan_applications_assigned_to_fkey(first_name, last_name)
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

  const filteredApplications = applications.filter((app) => {
    // Filter by status
    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    
    // Filter by stage
    if (stageFilter !== "all" && app.current_stage !== stageFilter) return false;
    
    // Filter by search query
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

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by application number or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Applications List */}
        <Card>
          <CardHeader>
            <CardTitle>All Applications</CardTitle>
            <CardDescription>
              {filteredApplications.length} application{filteredApplications.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredApplications.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No applications found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" || stageFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Create your first application to get started"}
                </p>
                <Button onClick={() => navigate("/los/applications/new")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Application
                </Button>
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
                          {isFreshApplication(app.created_at) ? (
                            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                              <Sparkles className="h-3 w-3 mr-1" />
                              NEW
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
                          <div>
                            <span className="font-medium">Applicant: </span>
                            {app.loan_applicants?.[0]
                              ? `${app.loan_applicants[0].first_name} ${app.loan_applicants[0].last_name || ""}`
                              : app.contacts
                                ? `${app.contacts.first_name} ${app.contacts.last_name || ""}`
                                : "Not linked"}
                          </div>
                          <div>
                            <span className="font-medium">Amount: </span>
                            {formatCurrency(app.requested_amount)}
                          </div>
                          <div>
                            <span className="font-medium">Tenure: </span>
                            {app.tenure_days} days
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

                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}