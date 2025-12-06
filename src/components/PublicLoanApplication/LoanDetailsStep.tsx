import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { IndianRupee, Calendar } from "lucide-react";

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
  const tenureDays = data.tenure || 30;
  const estimatedEMI = amount > 0 && tenureDays > 0
    ? Math.round((amount * (1 + (0.12 * tenureDays / 365))) / tenureDays)
    : 0;

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
          <span className="text-sm font-medium">{tenureDays} days</span>
        </div>
        <Slider
          value={[tenureDays]}
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

      {/* EMI Estimate */}
      {estimatedEMI > 0 && (
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Estimated Monthly EMI</span>
          </div>
          <p className="text-2xl font-bold text-primary">
            ₹{new Intl.NumberFormat("en-IN").format(estimatedEMI)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            *Approximate EMI at 12% p.a. Actual EMI may vary based on your profile.
          </p>
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
