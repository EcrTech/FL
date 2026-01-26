import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Wallet, Calendar, User, ArrowRight, Shield } from "lucide-react";

interface LoanRequirementsScreenProps {
  formData: {
    name: string;
    requestedAmount: number;
    tenureDays: number;
  };
  onUpdate: (data: Partial<{ name: string; requestedAmount: number; tenureDays: number }>) => void;
  onContinue: () => void;
}

export function LoanRequirementsScreen({
  formData,
  onUpdate,
  onContinue,
}: LoanRequirementsScreenProps) {
  const [localAmount, setLocalAmount] = useState(formData.requestedAmount || 25000);
  const [localTenure, setLocalTenure] = useState(formData.tenureDays || 30);

  // Sync local state with form data
  useEffect(() => {
    if (formData.requestedAmount > 0) setLocalAmount(formData.requestedAmount);
    if (formData.tenureDays > 0) setLocalTenure(formData.tenureDays);
  }, [formData.requestedAmount, formData.tenureDays]);

  const handleAmountChange = (value: number) => {
    setLocalAmount(value);
    onUpdate({ requestedAmount: value });
  };

  const handleTenureChange = (value: number) => {
    setLocalTenure(value);
    onUpdate({ tenureDays: value });
  };

  const isValidAmount = localAmount >= 5000 && localAmount <= 100000;
  const isValidTenure = localTenure >= 1 && localTenure <= 90;
  const isValidName = formData.name.trim().length >= 2;
  const canContinue = isValidAmount && isValidTenure && isValidName;

  return (
    <div className="flex flex-col min-h-[calc(100vh-130px)]">
      {/* Title Section */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--gold-500))]/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-[hsl(var(--gold-500))]" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">
              What do you need?
            </h2>
            <p className="text-sm text-muted-foreground">
              Tell us about your loan requirement
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="flex-1 px-4 pb-4">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-5">
          {/* Loan Amount Field */}
          <div className="space-y-3">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <span className="text-[hsl(var(--gold-500))]">₹</span>
              Loan Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                ₹
              </div>
              <Input
                type="number"
                placeholder="Enter amount (₹5,000-₹1,00,000)"
                value={localAmount || ""}
                onChange={(e) => handleAmountChange(parseInt(e.target.value) || 0)}
                min={5000}
                max={100000}
                className="h-[52px] pl-9 text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>
            {/* Slider */}
            <div className="pt-1 pb-2">
              <Slider
                value={[localAmount]}
                onValueChange={([val]) => handleAmountChange(val)}
                min={5000}
                max={100000}
                step={1000}
                className="w-full"
              />
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground font-medium">
                <span>₹5,000</span>
                <span>₹1,00,000</span>
              </div>
            </div>
            {localAmount > 0 && !isValidAmount && (
              <p className="text-xs text-destructive">
                Please enter an amount between ₹5,000 and ₹1,00,000
              </p>
            )}
          </div>

          {/* Tenure Field */}
          <div className="space-y-3">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Tenure (Days) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              placeholder="Select tenure (1-90 days)"
              value={localTenure || ""}
              onChange={(e) => handleTenureChange(parseInt(e.target.value) || 0)}
              min={1}
              max={90}
              className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            {/* Slider */}
            <div className="pt-1 pb-2">
              <Slider
                value={[localTenure]}
                onValueChange={([val]) => handleTenureChange(val)}
                min={1}
                max={90}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground font-medium">
                <span>1 day</span>
                <span>90 days</span>
              </div>
            </div>
            {localTenure > 0 && !isValidTenure && (
              <p className="text-xs text-destructive">
                Please enter a tenure between 1 and 90 days
              </p>
            )}
          </div>

          {/* Full Name Field */}
          <div className="space-y-2">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Full Name (as per PAN) <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <p className="text-[11px] text-muted-foreground">
              Name must match your PAN card exactly
            </p>
          </div>

          {/* Continue Button */}
          <Button
            onClick={onContinue}
            disabled={!canContinue}
            className="w-full h-[54px] text-base font-heading font-semibold rounded-[14px] bg-gradient-to-r from-primary to-[hsl(var(--teal-600))] shadow-[var(--shadow-teal)] hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none"
          >
            Continue
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>

          {/* Trust badge */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
            <Shield className="h-3.5 w-3.5" />
            <span>Your data is 256-bit secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
