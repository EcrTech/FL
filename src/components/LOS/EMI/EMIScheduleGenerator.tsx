import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEMISchedule } from "@/hooks/useEMISchedule";
import { Calendar, Calculator } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EMIScheduleGeneratorProps {
  applicationId: string;
  sanction: {
    id: string;
    sanctioned_amount: number;
    interest_rate: number;
    tenure_days: number;
  };
  disbursement: {
    disbursement_date: string;
  };
}

export default function EMIScheduleGenerator({
  applicationId,
  sanction,
  disbursement,
}: EMIScheduleGeneratorProps) {
  const { schedule, generateSchedule, isGenerating } = useEMISchedule(applicationId);
  const [emiAmount, setEmiAmount] = useState<number>(0);

  useEffect(() => {
    // Calculate total repayment preview (daily interest model)
    const dailyRate = sanction.interest_rate / 100; // Rate is % per day
    const totalInterest = sanction.sanctioned_amount * dailyRate * sanction.tenure_days;
    const totalRepayment = sanction.sanctioned_amount + totalInterest;
    setEmiAmount(Math.round(totalRepayment * 100) / 100);
  }, [sanction]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (schedule && schedule.length > 0) {
    return (
      <Alert>
        <Calculator className="h-4 w-4" />
        <AlertDescription>
          EMI schedule has already been generated with {schedule.length} installments.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Generate EMI Schedule
        </CardTitle>
        <CardDescription>
          Create a repayment schedule based on the sanctioned loan terms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Loan Amount</div>
            <div className="text-lg font-semibold">
              {formatCurrency(sanction.sanctioned_amount)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Interest Rate</div>
            <div className="text-lg font-semibold">{sanction.interest_rate}% per day</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Tenure</div>
            <div className="text-lg font-semibold">{sanction.tenure_days} days</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Total Repayment</div>
            <div className="text-lg font-semibold text-primary">
              {formatCurrency(emiAmount)}
            </div>
          </div>

          <div className="space-y-1 md:col-span-2">
            <div className="text-sm text-muted-foreground">First EMI Date</div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {new Date(
                new Date(disbursement.disbursement_date).setMonth(
                  new Date(disbursement.disbursement_date).getMonth() + 1
                )
              ).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="text-sm font-medium">Repayment Summary</div>
          <div className="text-2xl font-bold">
            {formatCurrency(emiAmount)}
          </div>
          <div className="text-xs text-muted-foreground">
            Interest: {formatCurrency(emiAmount - sanction.sanctioned_amount)} ({sanction.interest_rate}% × {sanction.tenure_days} days)
          </div>
        </div>

        <Button
          onClick={() =>
            generateSchedule({
              applicationId,
              sanctionId: sanction.id,
              loanAmount: sanction.sanctioned_amount,
              interestRate: sanction.interest_rate,
              tenureDays: sanction.tenure_days,
              disbursementDate: disbursement.disbursement_date,
            })
          }
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? "Generating..." : "Generate EMI Schedule"}
        </Button>
      </CardContent>
    </Card>
  );
}
