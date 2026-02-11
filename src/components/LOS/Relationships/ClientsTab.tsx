import { useState } from "react";
import { format } from "date-fns";
import { useCustomerRelationships, CustomerRelationship } from "@/hooks/useCustomerRelationships";
import { CustomerDetailDialog } from "./CustomerDetailDialog";
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
import { Search, Users, Download, TrendingUp, IndianRupee, AlertCircle, Eye } from "lucide-react";

const scoreConfig: Record<string, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "bg-green-500" },
  good: { label: "Good", color: "bg-blue-500" },
  fair: { label: "Fair", color: "bg-amber-500" },
  poor: { label: "Poor", color: "bg-red-500" },
};

export function ClientsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const handleExportCSV = () => {
    if (!filteredCustomers.length) return;

    // Build filename with filter info
    let filename = `customers-${format(new Date(), "yyyy-MM-dd")}`;
    if (scoreFilter !== "all") filename += `_score-${scoreFilter}`;
    if (statusFilter !== "all") filename += `_${statusFilter}`;
    if (debouncedSearch) filename += `_search`;

    // Build filter metadata row
    const filterParts = [];
    filterParts.push(`Payment Score: ${scoreFilter === "all" ? "All" : scoreFilter}`);
    filterParts.push(`Status: ${statusFilter === "all" ? "All" : statusFilter}`);
    if (debouncedSearch) filterParts.push(`Search: "${debouncedSearch}"`);
    const filterInfo = [`"Filters Applied: ${filterParts.join(", ")}"`];

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
            <Button onClick={handleExportCSV} variant="outline" disabled={!filteredCustomers.length}>
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
                  : "Clients will appear here once loans are disbursed"
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
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="text-center">Total Loans</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Disbursed</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Payment Score</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const score = scoreConfig[customer.paymentScore] || { label: customer.paymentScore, color: "bg-gray-500" };
                    
                    return (
                      <TableRow 
                        key={customer.customerId} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(customer)}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          {customer.customerId}
                        </TableCell>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="font-mono text-sm">{customer.panNumber}</TableCell>
                        <TableCell className="text-sm">{customer.mobile}</TableCell>
                        <TableCell className="text-center">{customer.totalLoans}</TableCell>
                        <TableCell className="text-center">
                          <span className={customer.activeLoans > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                            {customer.activeLoans}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(customer.totalDisbursed)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={customer.outstandingAmount > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                            {formatCurrency(customer.outstandingAmount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${score.color} text-white`}>
                            {score.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {customer.lastApplicationDate 
                            ? format(new Date(customer.lastApplicationDate), "dd MMM yyyy")
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(customer);
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

      <CustomerDetailDialog
        customer={selectedCustomer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
