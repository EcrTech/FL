import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { IndianRupee, Calendar, TrendingUp } from "lucide-react";

interface LoanDetailsStepProps {
  data: {
    productType: string;
    amount: string;
    tenure: number;
  };
  onChange: (data: Partial<LoanDetailsStepProps["data"]>) => void;
  onNext: () => void;
}

const productTypeLabels: Record<string, string> = {
  personal_loan: "Personal Loan",
  home_loan: "Home Loan",
  business_loan: "Business Loan",
  education_loan: "Education Loan",
  vehicle_loan: "Vehicle Loan",
};

// Interest rate: 1% per day
const DAILY_INTEREST_RATE = 1;

export function LoanDetailsStep({ data, onChange, onNext }: LoanDetailsStepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount < 10000 || amount > 5000000) {
      return;
    }
    
    onNext();
  };

  const formatAmount = (value: string) => {
    const num = value.replace(/[^0-9]/g, "");
    if (!num) return "";
    return new Intl.NumberFormat("en-IN").format(parseInt(num));
  };

  const parseAmount = (value: string) => {
    return value.replace(/[^0-9]/g, "");
  };

  const amount = parseFloat(data.amount) || 0;
  const tenure = data.tenure || 7;

  // Calculate interest and total repayment
  const interestAmount = amount * (DAILY_INTEREST_RATE / 100) * tenure;
  const totalRepayment = amount + interestAmount;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Loan Details</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Tell us about your loan requirement
        </p>
      </div>

      {/* Product Type (Read-only) */}
      <div className="space-y-2">
        <Label>Loan Type</Label>
        <div className="p-3 bg-muted rounded-lg font-medium">
          {productTypeLabels[data.productType] || data.productType || "Personal Loan"}
        </div>
      </div>

      {/* Loan Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Loan Amount *</Label>
        <div className="relative">
          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="amount"
            type="text"
            placeholder="Enter amount"
            value={formatAmount(data.amount)}
            onChange={(e) => onChange({ amount: parseAmount(e.target.value) })}
            className="pl-9"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Min: ₹10,000 | Max: ₹50,00,000
        </p>
        {amount > 0 && (amount < 10000 || amount > 5000000) && (
          <p className="text-xs text-destructive">
            Amount must be between ₹10,000 and ₹50,00,000
          </p>
        )}
      </div>

      {/* Tenure */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Loan Tenure</Label>
          <span className="text-sm font-medium">{tenure} days</span>
        </div>
        <Slider
          value={[tenure]}
          onValueChange={([value]) => onChange({ tenure: value })}
          min={1}
          max={90}
          step={1}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 day</span>
          <span>90 days</span>
        </div>
      </div>

      {/* Interest Rate Display */}
      {amount > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-4 w-4" />
            <span className="font-medium text-sm">Interest Calculation</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Daily Interest Rate</p>
              <p className="font-semibold text-lg text-primary">{DAILY_INTEREST_RATE}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tenure</p>
              <p className="font-semibold">{tenure} days</p>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Principal Amount</span>
              <span className="font-medium">₹{formatAmount(data.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Interest ({DAILY_INTEREST_RATE}% × {tenure} days)</span>
              <span className="font-medium text-amber-600">₹{new Intl.NumberFormat("en-IN").format(Math.round(interestAmount))}</span>
            </div>
            <div className="flex justify-between text-base pt-2 border-t">
              <span className="font-medium">Total Repayment</span>
              <span className="font-bold text-primary">₹{new Intl.NumberFormat("en-IN").format(Math.round(totalRepayment))}</span>
            </div>
          </div>
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full"
        disabled={!amount || amount < 10000 || amount > 5000000}
      >
        Continue
      </Button>
    </form>
  );
}
