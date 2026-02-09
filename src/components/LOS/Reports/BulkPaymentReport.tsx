import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Download, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { format, subDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { generateBulkPaymentExcel, type BulkPaymentRow } from "@/utils/bulkPaymentExport";
import { toast } from "sonner";

export default function BulkPaymentReport() {
  const { orgId } = useOrgContext();
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["bulk-payment-report", orgId, fromDate, toDate, stageFilter],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from("loan_applications")
        .select(`
          id,
          application_number,
          current_stage,
          created_at,
          loan_applicants!inner (
            first_name,
            last_name,
            bank_account_holder_name,
            bank_account_number,
            bank_ifsc_code,
            email,
            mobile,
            is_primary
          ),
          loan_sanctions (
            net_disbursement_amount
          ),
          loan_disbursements (
            payment_mode,
            disbursement_date
          )
        `)
        .eq("org_id", orgId)
        .eq("loan_applicants.is_primary", true)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`);

      if (stageFilter === "all") {
        query = query.in("current_stage", ["sanctioned", "disbursement_pending", "disbursed"]);
      } else {
        query = query.eq("current_stage", stageFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const mappedRows: BulkPaymentRow[] = records.map((app: any) => {
    const applicant = app.loan_applicants?.[0];
    const sanction = app.loan_sanctions?.[0];
    const disbursement = app.loan_disbursements?.[0];

    return {
      applicationNumber: app.application_number || "",
      beneficiaryName: applicant?.bank_account_holder_name || `${applicant?.first_name || ""} ${applicant?.last_name || ""}`.trim(),
      accountNumber: applicant?.bank_account_number || "",
      ifscCode: applicant?.bank_ifsc_code || "",
      amount: sanction?.net_disbursement_amount || 0,
      paymentMode: disbursement?.payment_mode || "NEFT",
      email: applicant?.email || "",
      mobile: applicant?.mobile || "",
    };
  });

  const handleDownload = () => {
    if (mappedRows.length === 0) {
      toast.error("No records to export");
      return;
    }
    generateBulkPaymentExcel(mappedRows);
    toast.success(`Downloaded BLKPAY report with ${mappedRows.length} records`);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              Bulk Payment Report
            </h1>
            <p className="text-muted-foreground text-sm">
              Generate BLKPAY Excel file for bank bulk payment upload
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stage</Label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">All (Sanctioned + Pending + Disbursed)</SelectItem>
                     <SelectItem value="sanctioned">Sanctioned</SelectItem>
                     <SelectItem value="disbursement_pending">Disbursement Pending</SelectItem>
                     <SelectItem value="disbursed">Disbursed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleDownload} disabled={mappedRows.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Download BLKPAY ({mappedRows.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Preview ({mappedRows.length} records)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : mappedRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No records found for selected filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Sr No</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Beneficiary Name</TableHead>
                      <TableHead>Account No</TableHead>
                      <TableHead>IFSC</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Mobile</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.paymentMode.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{row.beneficiaryName}</TableCell>
                        <TableCell className="font-mono text-sm">{row.accountNumber}</TableCell>
                        <TableCell className="font-mono text-sm">{row.ifscCode}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                        <TableCell>{row.applicationNumber}</TableCell>
                        <TableCell>{row.mobile}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
