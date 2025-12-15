import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndianRupee, Calendar, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { useEMIStats } from "@/hooks/useEMIStats";
import { LoadingState } from "@/components/common/LoadingState";
import { useNavigate } from "react-router-dom";

export default function Collections() {
  const { data: stats, isLoading } = useEMIStats();
  const navigate = useNavigate();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading collections data..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-muted-foreground">EMI collection and repayment tracking</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid EMIs</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.paidEMIs || 0}</div>
            <p className="text-xs text-muted-foreground">Successfully collected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending EMIs</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendingEMIs || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue EMIs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.overdueEMIs || 0}</div>
            <p className="text-xs text-muted-foreground">Requires follow-up</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.collectionRate?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.totalCollected || 0)} of {formatCurrency(stats?.totalExpected || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming EMIs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming EMIs (Next 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.upcomingEMIs && stats.upcomingEMIs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>EMI Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.upcomingEMIs.map((emi: any) => {
                  const applicant = emi.loan_applications?.loan_applicants?.[0];
                  const applicantName = applicant
                    ? `${applicant.first_name} ${applicant.last_name || ""}`.trim()
                    : "N/A";

                  return (
                    <TableRow key={emi.id}>
                      <TableCell className="font-medium">
                        {emi.loan_applications?.application_number || "N/A"}
                      </TableCell>
                      <TableCell>{applicantName}</TableCell>
                      <TableCell>{formatDate(emi.due_date)}</TableCell>
                      <TableCell>{formatCurrency(emi.total_emi)}</TableCell>
                      <TableCell>{getStatusBadge(emi.status)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/los/applications/${emi.loan_application_id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No upcoming EMIs in the next 30 days
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
