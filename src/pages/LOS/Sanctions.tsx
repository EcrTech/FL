import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, Loader2 } from "lucide-react";
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

  const { data: applications, isLoading } = useQuery({
    queryKey: ["approved-applications", orgId],
    queryFn: async () => {
      // Fetch approved applications
      const { data: applicationsData, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("org_id", orgId as string)
        .eq("status", "approved")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (!applicationsData || applicationsData.length === 0) return [];

      // Fetch primary applicants
      const applicationIds = applicationsData.map((a: any) => a.id);
      const { data: applicants } = await supabase
        .from("loan_applicants")
        .select("loan_application_id, first_name, last_name")
        .in("loan_application_id", applicationIds)
        .eq("applicant_type", "primary");

      // Merge the data
      return applicationsData.map((app: any) => {
        const applicant = applicants?.find((a) => a.loan_application_id === app.id);
        return {
          ...app,
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
            <p className="text-muted-foreground">Approved applications pending sanction</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Approved Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !applications || applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Approved Applications</h3>
                <p className="text-muted-foreground">No applications pending sanction at this time.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application No.</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Loan Type</TableHead>
                    <TableHead>Approved Amount</TableHead>
                    <TableHead>Approved Tenure</TableHead>
                    <TableHead>Approved Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        {app.application_number}
                      </TableCell>
                      <TableCell>{app.applicant_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {app.product_type || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {app.approved_amount ? formatCurrency(app.approved_amount) : "—"}
                      </TableCell>
                      <TableCell>
                        {app.tenure_days ? `${Math.round(app.tenure_days / 30)} months` : "—"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(app.updated_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/los/applications/${app.id}?mode=review`)
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
