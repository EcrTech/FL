import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Clock, User, DollarSign } from "lucide-react";

interface ApprovalQueueProps {
  orgId: string;
  userId: string;
}

export default function ApprovalQueue({ orgId, userId }: ApprovalQueueProps) {
  const navigate = useNavigate();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["approval-queue", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          contacts (
            first_name,
            last_name,
            email,
            phone
          ),
          loan_eligibility (
            eligible_loan_amount,
            is_eligible
          )
        `)
        .eq("org_id", orgId)
        .eq("current_stage", "approval_pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading approval queue...</div>
        </CardContent>
      </Card>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No applications pending approval
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Approval Queue</h2>
          <p className="text-muted-foreground">{applications.length} applications pending</p>
        </div>
      </div>

      <div className="grid gap-4">
        {applications.map((app: any) => {
          const contact = app.contacts;
          const eligibility = app.loan_eligibility?.[0];

          return (
            <Card key={app.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {contact?.first_name} {contact?.last_name}
                    </CardTitle>
                    <CardDescription>
                      Application #{app.id.slice(0, 8)}
                    </CardDescription>
                  </div>
                  <Badge variant={eligibility?.is_eligible ? "default" : "destructive"}>
                    {eligibility?.is_eligible ? "Eligible" : "Not Eligible"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Requested Amount</div>
                      <div className="font-medium">
                        ₹{app.loan_amount?.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Eligible Amount</div>
                      <div className="font-medium">
                        ₹{eligibility?.eligible_loan_amount?.toLocaleString("en-IN") || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Submitted</div>
                      <div className="font-medium">
                        {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={() => navigate(`/los/applications/${app.id}`)}>
                    Review Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
