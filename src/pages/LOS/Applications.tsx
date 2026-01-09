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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, FileText, Sparkles, UserPlus } from "lucide-react";
import { differenceInHours, format } from "date-fns";
import { LoadingState } from "@/components/common/LoadingState";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/common/PaginationControls";

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
    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    if (stageFilter !== "all" && app.current_stage !== stageFilter) return false;
    
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

  const pagination = usePagination({
    defaultPageSize: 25,
    totalRecords: filteredApplications.length,
  });

  const paginatedApplications = filteredApplications.slice(
    (pagination.currentPage - 1) * pagination.pageSize,
    pagination.currentPage * pagination.pageSize
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getApplicantName = (app: any) => {
    if (app.loan_applicants?.[0]) {
      return `${app.loan_applicants[0].first_name} ${app.loan_applicants[0].last_name || ""}`.trim();
    }
    if (app.contacts) {
      return `${app.contacts.first_name} ${app.contacts.last_name || ""}`.trim();
    }
    return "Not linked";
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

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Applications</CardTitle>
            <CardDescription>
              {filteredApplications.length} application{filteredApplications.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredApplications.length === 0 ? (
              <div className="text-center py-12 px-6">
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground">Loan ID</TableHead>
                        <TableHead className="font-semibold text-foreground">Application #</TableHead>
                        <TableHead className="font-semibold text-foreground">Applicant</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                        <TableHead className="font-semibold text-foreground">Stage</TableHead>
                        <TableHead className="font-semibold text-foreground">Amount</TableHead>
                        <TableHead className="font-semibold text-foreground">Tenure</TableHead>
                        <TableHead className="font-semibold text-foreground">Created</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedApplications.map((app) => (
                        <TableRow
                          key={app.id}
                          className="cursor-pointer hover:bg-muted/30 border-b"
                          onClick={() => navigate(`/los/applications/${app.id}`)}
                        >
                          <TableCell className="py-4">
                            <span className="font-mono font-medium text-primary">{app.loan_id || "-"}</span>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-medium text-foreground">{app.application_number}</span>
                              {isFreshApplication(app.created_at) && (
                                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  NEW
                                </Badge>
                              )}
                              {app.source === "referral_link" && (
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Referral
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="font-medium">{getApplicantName(app)}</span>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge className={`${STATUS_COLORS[app.status] || "bg-muted"} text-white px-3 py-1`}>
                              {app.status.replace("_", " ").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className="px-3 py-1">
                              {STAGE_LABELS[app.current_stage] || app.current_stage}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 font-medium text-green-600">
                            {formatCurrency(app.requested_amount)}
                          </TableCell>
                          <TableCell className="py-4 text-muted-foreground">
                            {app.tenure_days} days
                          </TableCell>
                          <TableCell className="py-4 text-muted-foreground">
                            {format(new Date(app.created_at), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/los/applications/${app.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="px-6 pb-4">
                  <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalRecords={filteredApplications.length}
                    startRecord={pagination.startRecord}
                    endRecord={pagination.endRecord}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
