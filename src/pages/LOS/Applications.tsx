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
import { Plus, Search, Filter, Eye, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { LoadingState } from "@/components/common/LoadingState";

interface LoanApplication {
  id: string;
  application_number: string;
  contact_id: string | null;
  requested_amount: number;
  tenure_months: number;
  current_stage: string;
  status: string;
  created_at: string;
  assigned_to: string | null;
  contacts: {
    first_name: string;
    last_name: string | null;
  } | null;
  profiles: {
    first_name: string;
    last_name: string | null;
  } | null;
}

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
};

export default function Applications() {
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const { permissions } = useLOSPermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["loan-applications", orgId, stageFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("loan_applications")
        .select(`
          *,
          contacts(first_name, last_name),
          assigned_profile:profiles!assigned_to(first_name, last_name)
        `)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (stageFilter !== "all") {
        query = query.eq("current_stage", stageFilter);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any;
    },
    enabled: !!orgId,
  });

  // Get stage counts
  const { data: stageCounts } = useQuery({
    queryKey: ["loan-stage-counts", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("current_stage")
        .eq("org_id", orgId);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((app) => {
        counts[app.current_stage] = (counts[app.current_stage] || 0) + 1;
      });
      return counts;
    },
    enabled: !!orgId,
  });

  const filteredApplications = applications.filter((app) => {
    const searchLower = searchQuery.toLowerCase();
    const contactName = app.contacts
      ? `${app.contacts.first_name} ${app.contacts.last_name || ""}`.toLowerCase()
      : "";
    return (
      app.application_number.toLowerCase().includes(searchLower) ||
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

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{applications.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {applications.filter((a) => a.status === "in_progress").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {applications.filter((a) => a.status === "approved").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Disbursed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {applications.filter((a) => a.status === "disbursed").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by application number or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {Object.entries(STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label} {stageCounts?.[value] ? `(${stageCounts[value]})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Applications List */}
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
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
                  Get started by creating your first loan application
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
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold">
                          {app.application_number}
                        </span>
                        <Badge className={STATUS_COLORS[app.status]}>
                          {app.status.replace("_", " ").toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {STAGE_LABELS[app.current_stage] || app.current_stage}
                        </Badge>
                      </div>

                      <div className="grid gap-2 md:grid-cols-3 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Applicant: </span>
                          {app.contacts
                            ? `${app.contacts.first_name} ${app.contacts.last_name || ""}`
                            : "Not linked"}
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

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(app.created_at), "MMM dd, yyyy")}
                        </div>
                        {(app as any).assigned_profile && (
                          <div>
                            Assigned to: {(app as any).assigned_profile.first_name} {(app as any).assigned_profile.last_name}
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
