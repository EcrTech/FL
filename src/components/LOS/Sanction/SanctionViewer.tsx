import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";

interface SanctionViewerProps {
  applicationId: string;
}

export default function SanctionViewer({ applicationId }: SanctionViewerProps) {
  const { data: sanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*, loan_applicants(*)")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!sanction) {
    return null;
  }

  const primaryApplicant = application?.loan_applicants?.[0];
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateEMI = () => {
    const P = sanction.sanctioned_amount;
    const r = sanction.sanctioned_rate / 12 / 100;
    const n = sanction.sanctioned_tenure;
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return emi;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sanction Letter
            </CardTitle>
            <Badge variant={sanction.status === "active" ? "default" : "secondary"}>
              {sanction.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Sanction Number</div>
                <div className="font-medium font-mono">{sanction.sanction_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sanction Date</div>
                <div className="font-medium">
                  {format(new Date(sanction.created_at), "MMM dd, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Valid Until</div>
                <div className="font-medium">
                  {format(new Date(sanction.validity_date), "MMM dd, yyyy")}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sanction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">Loan Details</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Sanctioned Amount</div>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(sanction.sanctioned_amount)}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Interest Rate</div>
                  <div className="text-2xl font-bold">{sanction.sanctioned_rate}% p.a.</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Tenure</div>
                  <div className="text-2xl font-bold">{sanction.sanctioned_tenure} months</div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Payment Details</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Monthly EMI</div>
                  <div className="text-xl font-bold">{formatCurrency(calculateEMI())}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Processing Fee</div>
                  <div className="text-xl font-bold">{formatCurrency(sanction.processing_fee)}</div>
                </div>
              </div>
            </div>

            {sanction.conditions && (
              <div>
                <h4 className="font-medium mb-3">Terms & Conditions</h4>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">
                    {typeof sanction.conditions === 'object' && sanction.conditions !== null && 'terms' in sanction.conditions 
                      ? String((sanction.conditions as any).terms)
                      : JSON.stringify(sanction.conditions, null, 2)}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h4 className="font-medium mb-3">Applicant Information</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-medium">
                    {primaryApplicant?.first_name} {primaryApplicant?.last_name || ""}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Mobile</div>
                  <div className="font-medium">{primaryApplicant?.mobile || "N/A"}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
