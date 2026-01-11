import { useState } from "react";
import { format } from "date-fns";
import { useApplicationsList, ApplicationListItem } from "@/hooks/useApplicationsList";
import { ApplicationCard } from "./ApplicationCard";
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
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Search, FileText, Download, LayoutGrid, List, CheckCircle, Clock, XCircle, Banknote } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ApplicationsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
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

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
                <TabsList>
                  <TabsTrigger value="list" className="px-3">
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="grid" className="px-3">
                    <LayoutGrid className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button onClick={handleExportCSV} variant="outline" disabled={!filteredApplications.length}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
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
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {filteredApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      <ApplicationDetailDialog
        application={selectedApplication}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
