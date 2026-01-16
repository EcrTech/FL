import { useState } from "react";
import { format } from "date-fns";
import { useApplicationsList, ApplicationListItem } from "@/hooks/useApplicationsList";
import { ApplicationDetailDialog } from "./ApplicationDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Search, FileText, Download, CheckCircle, Clock, XCircle, Banknote, Eye, Check, X } from "lucide-react";

const stageConfig: Record<string, { label: string; color: string }> = {
  application: { label: "Application", color: "bg-slate-500" },
  documents: { label: "Documents", color: "bg-blue-500" },
  verification: { label: "Verification", color: "bg-purple-500" },
  assessment: { label: "Assessment", color: "bg-amber-500" },
  approval: { label: "Approval", color: "bg-cyan-500" },
  sanctioned: { label: "Sanctioned", color: "bg-green-500" },
  disbursed: { label: "Disbursed", color: "bg-emerald-600" },
  rejected: { label: "Rejected", color: "bg-red-500" },
};

export function ApplicationsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<ApplicationListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: applications, isLoading } = useApplicationsList(debouncedSearch);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // Filter applications
  const filteredApplications = applications?.filter((app) => {
    if (stageFilter !== "all" && app.currentStage !== stageFilter) {
      return false;
    }
    if (statusFilter === "approved" && !app.isApproved) {
      return false;
    }
    if (statusFilter === "sanctioned" && !app.isSanctioned) {
      return false;
    }
    if (statusFilter === "disbursed" && !app.isDisbursed) {
      return false;
    }
    if (statusFilter === "pending" && (app.isApproved || app.status === "rejected")) {
      return false;
    }
    if (statusFilter === "rejected" && app.status !== "rejected") {
      return false;
    }
    return true;
  }) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleViewDetails = (application: ApplicationListItem) => {
    setSelectedApplication(application);
    setDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredApplications.length) return;

    // Build filename with filter info
    let filename = `applications-${format(new Date(), "yyyy-MM-dd")}`;
    if (stageFilter !== "all") filename += `_stage-${stageFilter}`;
    if (statusFilter !== "all") filename += `_status-${statusFilter}`;
    if (debouncedSearch) filename += `_search`;

    // Build filter metadata row
    const filterParts = [];
    filterParts.push(`Stage: ${stageFilter === "all" ? "All" : stageFilter}`);
    filterParts.push(`Status: ${statusFilter === "all" ? "All" : statusFilter}`);
    if (debouncedSearch) filterParts.push(`Search: "${debouncedSearch}"`);
    const filterInfo = [`"Filters Applied: ${filterParts.join(", ")}"`];

    const headers = [
      "Application Number",
      "Loan ID",
      "Stage",
      "Status",
      "Applicant Name",
      "PAN",
      "Mobile",
      "Requested Amount",
      "Approved Amount",
      "Sanctioned Amount",
      "Disbursed Amount",
      "Created Date",
    ];

    const rows = filteredApplications.map((app) => [
      app.applicationNumber,
      app.loanId || "",
      app.currentStage,
      app.status,
      app.applicantName,
      app.panNumber,
      app.mobile,
      app.requestedAmount,
      app.approvedAmount || "",
      app.sanctionedAmount || "",
      app.disbursedAmount || "",
      format(new Date(app.createdAt), "dd/MM/yyyy"),
    ]);

    const csvContent = [filterInfo, headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats
  const stats = {
    total: applications?.length || 0,
    approved: applications?.filter((a) => a.isApproved).length || 0,
    sanctioned: applications?.filter((a) => a.isSanctioned).length || 0,
    disbursed: applications?.filter((a) => a.isDisbursed).length || 0,
    pending: applications?.filter((a) => !a.isApproved && a.status !== "rejected").length || 0,
    rejected: applications?.filter((a) => a.status === "rejected").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-2xl font-bold">{stats.sanctioned}</p>
                <p className="text-xs text-muted-foreground">Sanctioned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.disbursed}</p>
                <p className="text-xs text-muted-foreground">Disbursed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Search & Filter</CardTitle>
              <CardDescription>Find applications by number, PAN, mobile, or name</CardDescription>
            </div>
            <Button onClick={handleExportCSV} variant="outline" disabled={!filteredApplications.length}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by application number, PAN, mobile, name..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="application">Application</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
                <SelectItem value="verification">Verification</SelectItem>
                <SelectItem value="assessment">Assessment</SelectItem>
                <SelectItem value="approval">Approval</SelectItem>
                <SelectItem value="sanctioned">Sanctioned</SelectItem>
                <SelectItem value="disbursed">Disbursed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="sanctioned">Sanctioned</SelectItem>
                <SelectItem value="disbursed">Disbursed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <LoadingState message="Loading applications..." />
      ) : filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="No applications found"
              message={
                searchTerm
                  ? "Try adjusting your search or filters"
                  : "Applications will appear here once created"
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-center">Sanctioned</TableHead>
                    <TableHead className="text-center">Disbursed</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app) => {
                    const stage = stageConfig[app.currentStage] || { label: app.currentStage, color: "bg-gray-500" };
                    return (
                      <TableRow 
                        key={app.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(app)}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          {app.applicationNumber}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(app.createdAt), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">{app.applicantName}</TableCell>
                        <TableCell className="font-mono text-sm">{app.panNumber}</TableCell>
                        <TableCell className="text-sm">{app.mobile}</TableCell>
                        <TableCell>
                          <Badge className={`${stage.color} text-white`}>
                            {stage.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(app.requestedAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {app.approvedAmount ? formatCurrency(app.approvedAmount) : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {app.isSanctioned ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {app.isDisbursed ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(app);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ApplicationDetailDialog
        application={selectedApplication}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
