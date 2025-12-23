import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CreditCard, Search, Eye, Loader2, CheckCircle, 
  Clock, XCircle, Banknote, FileCheck
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useOrgContext } from "@/hooks/useOrgContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function Disbursals() {
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch applications ready for disbursal (all documents signed)
  const { data: readyForDisbursal, isLoading: loadingReady } = useQuery({
    queryKey: ["ready-for-disbursal", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      // Get applications where both documents are signed but no disbursement initiated
      const { data: applications } = await supabase
        .from("loan_applications")
        .select(`
          id,
          application_number,
          approved_amount,
          status,
          current_stage,
          created_at,
          loan_sanctions!inner(id)
        `)
        .eq("org_id", orgId)
        .in("current_stage", ["sanction", "sanctioned"])
        .order("created_at", { ascending: false });

      if (!applications) return [];

      // Filter to only those with all documents signed
      const readyApps = [];
      for (const app of applications) {
        const { data: docs } = await supabase
          .from("loan_generated_documents")
          .select("document_type, customer_signed")
          .eq("loan_application_id", app.id);

        const sanctionSigned = docs?.find(d => d.document_type === "sanction_letter")?.customer_signed;
        const agreementSigned = docs?.find(d => d.document_type === "loan_agreement")?.customer_signed;

        // Check if disbursement already exists
        const { data: existingDisbursement } = await supabase
          .from("loan_disbursements")
          .select("id")
          .eq("loan_application_id", app.id)
          .maybeSingle();

        if (sanctionSigned && agreementSigned && !existingDisbursement) {
          // Fetch applicant name
          const { data: applicant } = await supabase
            .from("loan_applicants")
            .select("first_name, last_name")
            .eq("loan_application_id", app.id)
            .eq("applicant_type", "primary")
            .maybeSingle();

          readyApps.push({
            ...app,
            applicant_name: applicant ? `${applicant.first_name} ${applicant.last_name || ""}`.trim() : "N/A",
          });
        }
      }

      return readyApps;
    },
    enabled: !!orgId,
  });

  // Fetch all disbursements
  const { data: disbursements, isLoading: loadingDisbursements } = useQuery({
    queryKey: ["all-disbursements", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data } = await supabase
        .from("loan_disbursements")
        .select(`
          *,
          loan_applications!inner(
            id,
            application_number,
            approved_amount,
            loan_applicants(first_name, last_name, applicant_type)
          )
        `)
        .eq("loan_applications.org_id", orgId)
        .order("created_at", { ascending: false });

      return data?.map(d => {
        const primaryApplicant = d.loan_applications?.loan_applicants?.find(
          (a: { applicant_type: string }) => a.applicant_type === "primary"
        );
        return {
          ...d,
          applicant_name: primaryApplicant 
            ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`.trim() 
            : "N/A",
          application_number: d.loan_applications?.application_number,
        };
      }) || [];
    },
    enabled: !!orgId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDisbursements = disbursements?.filter(d => {
    const matchesSearch = 
      d.disbursement_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.application_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const isLoading = loadingReady || loadingDisbursements;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Disbursals</h1>
        </div>

        {/* Ready for Disbursal Section */}
        {readyForDisbursal && readyForDisbursal.length > 0 && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <FileCheck className="h-5 w-5" />
                Ready for Disbursal ({readyForDisbursal.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application #</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Approved Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyForDisbursal.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-mono">{app.application_number}</TableCell>
                        <TableCell>{app.applicant_name}</TableCell>
                        <TableCell>{formatCurrency(app.approved_amount || 0)}</TableCell>
                        <TableCell>{format(new Date(app.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => navigate(`/los/applications/${app.id}?tab=disbursement`)}
                          >
                            <Banknote className="h-4 w-4 mr-2" />
                            Initiate Disbursal
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Disbursements */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>All Disbursements</CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDisbursements && filteredDisbursements.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Disbursement #</TableHead>
                      <TableHead>Application #</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>UTR</TableHead>
                      <TableHead>Proof</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDisbursements.map((disb) => (
                      <TableRow key={disb.id}>
                        <TableCell className="font-mono text-sm">{disb.disbursement_number}</TableCell>
                        <TableCell className="font-mono text-sm">{disb.application_number}</TableCell>
                        <TableCell>{disb.applicant_name}</TableCell>
                        <TableCell>{formatCurrency(disb.disbursement_amount)}</TableCell>
                        <TableCell>{getStatusBadge(disb.status)}</TableCell>
                        <TableCell className="font-mono text-sm">{disb.utr_number || "-"}</TableCell>
                        <TableCell>
                          {disb.proof_document_path ? (
                            <Badge variant="outline" className="gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Uploaded
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {disb.disbursement_date 
                            ? format(new Date(disb.disbursement_date), "MMM dd, yyyy")
                            : format(new Date(disb.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/los/applications/${disb.loan_application_id}?tab=disbursement`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <CreditCard className="h-12 w-12 mb-2 opacity-50" />
                <p>No disbursements found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
