import { useState } from "react";
import { format } from "date-fns";
import { useLoansList, LoanListItem } from "@/hooks/useLoansList";
import { LoanCard } from "./LoanCard";
import { LoanDetailDialog } from "./LoanDetailDialog";
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
import { Search, Banknote, Download, LayoutGrid, List, TrendingUp, AlertCircle, CheckCircle, IndianRupee } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LoansTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedLoan, setSelectedLoan] = useState<LoanListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: loans, isLoading } = useLoansList(debouncedSearch);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // Filter loans
  const filteredLoans = loans?.filter((loan) => {
    if (statusFilter === "active" && loan.paymentStatus === "completed") {
      return false;
    }
    if (statusFilter === "closed" && loan.paymentStatus !== "completed") {
      return false;
    }
    if (paymentFilter === "on_track" && loan.paymentStatus !== "on_track") {
      return false;
    }
    if (paymentFilter === "overdue" && loan.paymentStatus !== "overdue") {
      return false;
    }
    if (paymentFilter === "completed" && loan.paymentStatus !== "completed") {
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

  const handleViewDetails = (loan: LoanListItem) => {
    setSelectedLoan(loan);
    setDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredLoans.length) return;

    const headers = [
      "Loan ID",
      "Application Number",
      "Applicant Name",
      "PAN",
      "Mobile",
      "Disbursed Amount",
      "Total Paid",
      "Outstanding",
      "EMI Count",
      "Paid EMIs",
      "Overdue EMIs",
      "Payment Status",
      "On-Time %",
      "Disbursement Date",
    ];

    const rows = filteredLoans.map((loan) => [
      loan.loanId,
      loan.applicationNumber,
      loan.applicantName,
      loan.panNumber,
      loan.mobile,
      loan.disbursedAmount,
      loan.totalPaid,
      loan.outstandingAmount,
      loan.emiCount,
      loan.paidEmiCount,
      loan.overdueEmiCount,
      loan.paymentStatus,
      loan.onTimePaymentPercent,
      loan.disbursementDate ? format(new Date(loan.disbursementDate), "dd/MM/yyyy") : "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loans-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats
  const stats = {
    total: loans?.length || 0,
    active: loans?.filter((l) => l.paymentStatus !== "completed").length || 0,
    onTrack: loans?.filter((l) => l.paymentStatus === "on_track").length || 0,
    overdue: loans?.filter((l) => l.paymentStatus === "overdue").length || 0,
    completed: loans?.filter((l) => l.paymentStatus === "completed").length || 0,
    totalDisbursed: loans?.reduce((sum, l) => sum + l.disbursedAmount, 0) || 0,
    totalOutstanding: loans?.reduce((sum, l) => sum + l.outstandingAmount, 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Loans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.onTrack}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalDisbursed)}</p>
                <p className="text-xs text-muted-foreground">Total Disbursed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalOutstanding)}</p>
                <p className="text-xs text-muted-foreground">Total Outstanding</p>
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
              <CardDescription>Find loans by ID, application number, PAN, or name</CardDescription>
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
              <Button onClick={handleExportCSV} variant="outline" disabled={!filteredLoans.length}>
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
                placeholder="Search by loan ID, application number, PAN, mobile, name..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Loan Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Loans</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <LoadingState message="Loading loans..." />
      ) : filteredLoans.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Banknote className="h-12 w-12" />}
              title="No loans found"
              message={
                searchTerm
                  ? "Try adjusting your search or filters"
                  : "Disbursed loans will appear here"
              }
            />
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {filteredLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      <LoanDetailDialog
        loan={selectedLoan}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
