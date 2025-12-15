import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, FileText, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function Sanctions() {
  const { orgId } = useOrgContext();
  const navigate = useNavigate();

  const { data: sanctions, isLoading } = useQuery({
    queryKey: ["loan-sanctions-list", orgId],
    queryFn: async () => {
      // Fetch sanctions with application join
      const { data: sanctionsData, error } = await supabase
        .from("loan_sanctions")
        .select("*, loan_applications!inner(id, product_type, status, org_id)")
        .eq("loan_applications.org_id", orgId as string)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!sanctionsData || sanctionsData.length === 0) return [];

      // Fetch primary applicants
      const applicationIds = sanctionsData.map((s: any) => s.loan_application_id);
      const { data: applicants } = await supabase
        .from("loan_applicants")
        .select("loan_application_id, first_name, last_name")
        .in("loan_application_id", applicationIds)
        .eq("applicant_type", "primary");

      // Merge the data
      return sanctionsData.map((sanction: any) => {
        const applicant = applicants?.find((a) => a.loan_application_id === sanction.loan_application_id);
        return {
          ...sanction,
          loan_type: sanction.loan_applications?.product_type,
          app_status: sanction.loan_applications?.status,
          applicant_name: applicant
            ? [applicant.first_name, applicant.last_name].filter(Boolean).join(" ")
            : "N/A",
        };
      });
    },
    enabled: !!orgId,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sanctions</h1>
            <p className="text-muted-foreground">View all loan sanction letters</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sanction Letters
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !sanctions || sanctions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Sanctions Found</h3>
                <p className="text-muted-foreground">No sanction letters have been generated yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sanction No.</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Loan Type</TableHead>
                    <TableHead>Sanction Amount</TableHead>
                    <TableHead>Interest Rate</TableHead>
                    <TableHead>Sanction Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sanctions.map((sanction) => (
                    <TableRow key={sanction.id}>
                      <TableCell className="font-medium">
                        {sanction.sanction_number}
                      </TableCell>
                      <TableCell>{sanction.applicant_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {sanction.loan_type || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(sanction.sanctioned_amount)}
                      </TableCell>
                      <TableCell>{sanction.sanctioned_rate}%</TableCell>
                      <TableCell>
                        {format(new Date(sanction.sanction_date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sanction.app_status === "disbursed" ? "default" : "secondary"}
                        >
                          {sanction.app_status === "disbursed" ? "Disbursed" : "Pending Disbursement"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/los/applications/${sanction.loan_application_id}?mode=review`)
                          }
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
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
    </DashboardLayout>
  );
}
