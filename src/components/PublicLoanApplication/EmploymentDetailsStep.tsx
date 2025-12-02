import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, IndianRupee } from "lucide-react";

interface EmploymentDetailsStepProps {
  data: {
    employmentType: string;
    employerName: string;
    employerType: string;
    designation: string;
    grossSalary: string;
    netSalary: string;
    bankName: string;
    accountNumber: string;
  };
  onChange: (data: Partial<EmploymentDetailsStepProps["data"]>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const BANKS = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank",
  "IndusInd Bank", "Yes Bank", "Punjab National Bank", "Bank of Baroda", "Canara Bank",
  "Union Bank of India", "IDBI Bank", "Bank of India", "Central Bank of India",
  "Indian Overseas Bank", "UCO Bank", "Indian Bank", "Federal Bank", "South Indian Bank",
  "Karur Vysya Bank", "City Union Bank", "RBL Bank", "Bandhan Bank", "IDFC First Bank",
  "Other"
];

export function EmploymentDetailsStep({ data, onChange, onNext, onPrev }: EmploymentDetailsStepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!data.employerName.trim()) return;
    if (!data.grossSalary || parseFloat(data.grossSalary) <= 0) return;
    
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Employment Details</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Tell us about your employment and income
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Employment Type */}
        <div className="space-y-2">
          <Label>Employment Type *</Label>
          <Select value={data.employmentType} onValueChange={(value) => onChange({ employmentType: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="salaried">Salaried</SelectItem>
              <SelectItem value="self_employed">Self Employed</SelectItem>
              <SelectItem value="business">Business Owner</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Employer Type */}
        <div className="space-y-2">
          <Label>Employer Type</Label>
          <Select value={data.employerType} onValueChange={(value) => onChange({ employerType: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private Company</SelectItem>
              <SelectItem value="public">Public Sector</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="mnc">MNC</SelectItem>
              <SelectItem value="startup">Startup</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Employer Name */}
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="employerName">
            {data.employmentType === "self_employed" || data.employmentType === "business" 
              ? "Business Name *" 
              : "Employer Name *"}
          </Label>
          <Input
            id="employerName"
            value={data.employerName}
            onChange={(e) => onChange({ employerName: e.target.value })}
            placeholder="Enter employer/business name"
            required
          />
        </div>

        {/* Designation */}
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input
            id="designation"
            value={data.designation}
            onChange={(e) => onChange({ designation: e.target.value })}
            placeholder="Enter your designation"
          />
        </div>

        {/* Gross Salary */}
        <div className="space-y-2">
          <Label htmlFor="grossSalary">Gross Monthly Income *</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="grossSalary"
              type="text"
              value={formatAmount(data.grossSalary)}
              onChange={(e) => onChange({ grossSalary: parseAmount(e.target.value) })}
              placeholder="50,000"
              className="pl-9"
              required
            />
          </div>
        </div>

        {/* Net Salary */}
        <div className="space-y-2">
          <Label htmlFor="netSalary">Net Monthly Income</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="netSalary"
              type="text"
              value={formatAmount(data.netSalary)}
              onChange={(e) => onChange({ netSalary: parseAmount(e.target.value) })}
              placeholder="45,000"
              className="pl-9"
            />
          </div>
        </div>

        {/* Salary Bank */}
        <div className="space-y-2">
          <Label>Salary Bank Account</Label>
          <Select value={data.bankName} onValueChange={(value) => onChange({ bankName: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select bank" />
            </SelectTrigger>
            <SelectContent>
              {BANKS.map((bank) => (
                <SelectItem key={bank} value={bank}>{bank}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Account Number */}
        <div className="space-y-2">
          <Label htmlFor="accountNumber">Account Number</Label>
          <Input
            id="accountNumber"
            value={data.accountNumber}
            onChange={(e) => onChange({ accountNumber: e.target.value.replace(/\D/g, "").slice(0, 18) })}
            placeholder="Enter account number"
            maxLength={18}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onPrev} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={
            !data.employerName.trim() ||
            !data.grossSalary ||
            parseFloat(data.grossSalary) <= 0
          }
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
