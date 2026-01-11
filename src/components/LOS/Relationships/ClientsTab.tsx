import { useState } from "react";
import { format } from "date-fns";
import { useCustomerRelationships, CustomerRelationship } from "@/hooks/useCustomerRelationships";
import { CustomerDetailDialog } from "./CustomerDetailDialog";
import { CustomerCard } from "./CustomerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Search, Users, Download, LayoutGrid, List, TrendingUp, IndianRupee, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ClientsTab() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRelationship | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: customers, isLoading } = useCustomerRelationships(debouncedSearch);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // Filter customers
  const filteredCustomers = customers?.filter((customer) => {
    if (scoreFilter !== "all" && customer.paymentScore !== scoreFilter) {
      return false;
    }
    if (statusFilter === "active" && customer.activeLoans === 0) {
      return false;
    }
    if (statusFilter === "closed" && customer.activeLoans > 0) {
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

  const handleViewDetails = (customer: CustomerRelationship) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
  };

  const handleShareReferralLink = () => {
    navigate("/los/my-referrals");
  };

  const handleExportCSV = () => {
    if (!filteredCustomers.length) return;

    const headers = [
      "Customer ID",
      "Name",
      "PAN",
      "Mobile",
      "Total Loans",
      "Active Loans",
      "Total Disbursed",
      "Total Paid",
      "Outstanding",
      "Payment Score",
      "Last Application Date",
    ];

    const rows = filteredCustomers.map((c) => [
      c.customerId,
      c.name,
      c.panNumber,
      c.mobile,
      c.totalLoans,
      c.activeLoans,
      c.totalDisbursed,
      c.totalPaid,
      c.outstandingAmount,
      c.paymentScore,
      c.lastApplicationDate ? format(new Date(c.lastApplicationDate), "dd/MM/yyyy") : "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats
  const stats = {
    total: customers?.length || 0,
    withActiveLoans: customers?.filter((c) => c.activeLoans > 0).length || 0,
    totalDisbursed: customers?.reduce((sum, c) => sum + c.totalDisbursed, 0) || 0,
    totalOutstanding: customers?.reduce((sum, c) => sum + c.outstandingAmount, 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.withActiveLoans}</p>
                <p className="text-xs text-muted-foreground">With Active Loans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-lg font-bold">{formatCurrency(stats.totalDisbursed)}</p>
                <p className="text-xs text-muted-foreground">Total Disbursed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-lg font-bold">{formatCurrency(stats.totalOutstanding)}</p>
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
              <CardDescription>Find customers by PAN, mobile, name, or customer ID</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
                <TabsList>
                  <TabsTrigger value="grid" className="px-3">
                    <LayoutGrid className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list" className="px-3">
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button onClick={handleExportCSV} variant="outline" disabled={!filteredCustomers.length}>
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
                placeholder="Search by PAN, Mobile, Name, or Customer ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Payment Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Loans</SelectItem>
                <SelectItem value="closed">No Active Loans</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <LoadingState message="Loading customers..." />
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="No customers found"
              message={
                searchTerm
                  ? "Try adjusting your search or filters"
                  : "Customer relationships will appear here once loan applications are created"
              }
            />
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.customerId}
              customer={customer}
              onViewDetails={handleViewDetails}
              onShareReferralLink={handleShareReferralLink}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filteredCustomers.map((customer) => (
                <CustomerCard
                  key={customer.customerId}
                  customer={customer}
                  onViewDetails={handleViewDetails}
                  onShareReferralLink={handleShareReferralLink}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CustomerDetailDialog
        customer={selectedCustomer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
