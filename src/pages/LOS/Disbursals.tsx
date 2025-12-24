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

type UnifiedDisbursalItem = {
  id: string;
  application_id: string;
  application_number: string;
  applicant_name: string;
  amount: number;
  status: "ready" | "pending" | "completed" | "failed";
  utr_number?: string;
  has_proof?: boolean;
  date: string;
  disbursement_number?: string;
};

export default function Disbursals() {
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch all disbursal data in a unified way
  const { data: allDisbursals, isLoading } = useQuery({
    queryKey: ["unified-disbursals", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const unified: UnifiedDisbursalItem[] = [];

      // 1. Fetch applications ready for disbursal (all documents signed, no disbursement)
      const { data: applications } = await supabase
        .from("loan_applications")
        .select(`
          id,
          application_number,
          approved_amount,
          current_stage,
          created_at,
          loan_sanctions!inner(id)
        `)
        .eq("org_id", orgId)
        .in("current_stage", ["sanction", "sanctioned", "disbursement_pending"])
        .order("created_at", { ascending: false });

      if (applications) {
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

            unified.push({
              id: app.id,
              application_id: app.id,
              application_number: app.application_number,
              applicant_name: applicant ? `${applicant.first_name} ${applicant.last_name || ""}`.trim() : "N/A",
              amount: app.approved_amount || 0,
              status: "ready",
              date: app.created_at,
            });
          }
        }
      }

      // 2. Fetch all existing disbursements
      const { data: disbursements } = await supabase
        .from("loan_disbursements")
        .select(`
          *,
          loan_applications!inner(
            id,
            application_number,
            approved_amount,
            org_id,
            loan_applicants(first_name, last_name, applicant_type)
          )
        `)
        .eq("loan_applications.org_id", orgId)
        .order("created_at", { ascending: false });

      if (disbursements) {
        for (const d of disbursements) {
          const primaryApplicant = d.loan_applications?.loan_applicants?.find(
            (a: { applicant_type: string }) => a.applicant_type === "primary"
          );
          
          unified.push({
            id: d.id,
            application_id: d.loan_application_id,
            application_number: d.loan_applications?.application_number || "",
            applicant_name: primaryApplicant 
              ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`.trim() 
              : "N/A",
            amount: d.disbursement_amount,
            status: d.status as "pending" | "completed" | "failed",
            utr_number: d.utr_number,
            has_proof: !!d.proof_document_path,
            date: d.disbursement_date || d.created_at,
            disbursement_number: d.disbursement_number,
          });
        }
      }

      // Sort by date descending
      unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return unified;
    },
    enabled: !!orgId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge className="gap-1 bg-green-500">
            <FileCheck className="h-3 w-3" />
            Ready for Disbursal
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge className="gap-1 bg-primary">
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

  const filteredDisbursals = allDisbursals?.filter(d => {
    const matchesSearch = 
      d.disbursement_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.application_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Disbursals</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>All Disbursals</CardTitle>
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
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ready">Ready for Disbursal</SelectItem>
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
            ) : filteredDisbursals && filteredDisbursals.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                    {filteredDisbursals.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.application_number}</TableCell>
                        <TableCell>{item.applicant_name}</TableCell>
                        <TableCell>{formatCurrency(item.amount)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="font-mono text-sm">{item.utr_number || "-"}</TableCell>
                        <TableCell>
                          {item.has_proof ? (
                            <Badge variant="outline" className="gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Uploaded
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(item.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === "ready" ? (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/los/applications/${item.application_id}?tab=disbursement`)}
                            >
                              <Banknote className="h-4 w-4 mr-2" />
                              Initiate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/los/applications/${item.application_id}?tab=disbursement`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <CreditCard className="h-12 w-12 mb-2 opacity-50" />
                <p>No disbursals found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
