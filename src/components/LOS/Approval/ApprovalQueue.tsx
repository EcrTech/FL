import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Eye, FileText, Search, CalendarIcon, X, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ApprovalQueueProps {
  orgId: string;
  userId: string;
}

const STAGE_LABELS: Record<string, string> = {
  application_login: "Application Login",
  document_collection: "Document Collection",
  field_verification: "Field Verification",
  credit_assessment: "Credit Assessment",
  approval_pending: "Approval Pending",
  sanctioned: "Sanctioned",
  rejected: "Rejected",
  disbursement_pending: "Disbursement Pending",
  disbursed: "Disbursed",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STAGE_COLORS: Record<string, string> = {
  application_login: "bg-muted text-muted-foreground",
  document_collection: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  field_verification: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  credit_assessment: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  approval_pending: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  sanctioned: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  disbursement_pending: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  disbursed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export default function ApprovalQueue({ orgId, userId }: ApprovalQueueProps) {
  const navigate = useNavigate();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedProductType, setSelectedProductType] = useState<string>("all");

  const { data: applications, isLoading } = useQuery({
    queryKey: ["approval-queue", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants(*),
          assigned_profile:profiles!assigned_to(first_name, last_name)
        `)
        .eq("org_id", orgId)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getApplicantName = (app: any) => {
    const applicant = app.loan_applicants?.[0];
    if (!applicant) return "N/A";
    return `${applicant.first_name} ${applicant.last_name || ""}`.trim();
  };

  const getAssigneeName = (app: any) => {
    if (!app.assigned_profile) return "Unassigned";
    return `${app.assigned_profile.first_name} ${app.assigned_profile.last_name || ""}`.trim();
  };

  // Derive unique assignees and product types from data
  const { uniqueAssignees, uniqueProductTypes, uniqueStages } = useMemo(() => {
    if (!applications) return { uniqueAssignees: [], uniqueProductTypes: [], uniqueStages: [] };

    const assigneeMap = new Map<string, string>();
    const productSet = new Set<string>();
    const stageSet = new Set<string>();

    applications.forEach((app) => {
      if (app.assigned_to && app.assigned_profile) {
        assigneeMap.set(app.assigned_to, getAssigneeName(app));
      }
      if (app.product_type) productSet.add(app.product_type);
      if (app.current_stage) stageSet.add(app.current_stage);
    });

    return {
      uniqueAssignees: Array.from(assigneeMap.entries()).map(([id, name]) => ({ id, name })),
      uniqueProductTypes: Array.from(productSet).sort(),
      uniqueStages: Array.from(stageSet).sort(),
    };
  }, [applications]);

  // Client-side filtering
  const filteredApplications = useMemo(() => {
    if (!applications) return [];

    return applications.filter((app) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const applicantName = getApplicantName(app).toLowerCase();
        const loanId = (app.loan_id || "").toLowerCase();
        const appNum = (app.application_number || "").toLowerCase();
        if (!loanId.includes(q) && !appNum.includes(q) && !applicantName.includes(q)) return false;
      }

      // Stage
      if (selectedStages.length > 0 && !selectedStages.includes(app.current_stage)) return false;

      // Assignee
      if (selectedAssignee !== "all" && app.assigned_to !== selectedAssignee) return false;

      // Amount range
      const minAmt = amountMin ? parseFloat(amountMin) : null;
      const maxAmt = amountMax ? parseFloat(amountMax) : null;
      if (minAmt !== null && app.requested_amount < minAmt) return false;
      if (maxAmt !== null && app.requested_amount > maxAmt) return false;

      // Date range
      if (dateFrom) {
        const created = new Date(app.created_at);
        if (created < dateFrom) return false;
      }
      if (dateTo) {
        const created = new Date(app.created_at);
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (created > endOfDay) return false;
      }

      // Product type
      if (selectedProductType !== "all" && app.product_type !== selectedProductType) return false;

      return true;
    });
  }, [applications, searchQuery, selectedStages, selectedAssignee, amountMin, amountMax, dateFrom, dateTo, selectedProductType]);

  const toggleStage = (stage: string) => {
    setSelectedStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  const hasActiveFilters = searchQuery || selectedStages.length > 0 || selectedAssignee !== "all" || amountMin || amountMax || dateFrom || dateTo || selectedProductType !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStages([]);
    setSelectedAssignee("all");
    setAmountMin("");
    setAmountMax("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedProductType("all");
  };

  if (isLoading) {
    return <LoadingState message="Loading applications..." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Approval Queue</h2>
        <p className="text-muted-foreground">Review and process in-progress loan applications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            In-Progress Applications
          </CardTitle>
          <CardDescription>
            {hasActiveFilters
              ? `Showing ${filteredApplications.length} of ${applications?.length || 0} application(s)`
              : `${applications?.length || 0} application(s) requiring attention`}
          </CardDescription>
        </CardHeader>

        {/* Filter Bar */}
        <div className="px-6 pb-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Loan ID, App # or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Stage Multi-Select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  Stage
                  {selectedStages.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {selectedStages.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1">
                  {uniqueStages.map((stage) => (
                    <label
                      key={stage}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedStages.includes(stage)}
                        onCheckedChange={() => toggleStage(stage)}
                      />
                      {STAGE_LABELS[stage] || stage}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Assigned To */}
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="Assigned To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {uniqueAssignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Product Type */}
            {uniqueProductTypes.length > 0 && (
              <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                <SelectTrigger className="w-[160px] h-10">
                  <SelectValue placeholder="Product Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {uniqueProductTypes.map((pt) => (
                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 gap-1">
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Second row: Amount range + Date range */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                placeholder="Min Amount"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                className="w-[130px] h-9"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                placeholder="Max Amount"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                className="w-[130px] h-9"
              />
            </div>

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, "MMM dd, yy") : "From Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, "MMM dd, yy") : "To Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <CardContent>
          {filteredApplications.length === 0 ? (
            <EmptyState
              title={hasActiveFilters ? "No matching applications" : "No applications in queue"}
              message={hasActiveFilters ? "Try adjusting your filters." : "There are no in-progress applications at this time."}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan ID</TableHead>
                  <TableHead>Application #</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium text-primary">
                      {app.loan_id || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {app.application_number}
                    </TableCell>
                    <TableCell>{getApplicantName(app)}</TableCell>
                    <TableCell>{formatCurrency(app.requested_amount)}</TableCell>
                    <TableCell>
                      <Badge className={STAGE_COLORS[app.current_stage] || "bg-muted"}>
                        {STAGE_LABELS[app.current_stage] || app.current_stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(app.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>{getAssigneeName(app)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/los/applications/${app.id}?mode=review`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
