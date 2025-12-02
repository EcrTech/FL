import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

interface PersonalDetailsStepProps {
  data: {
    fullName: string;
    dob: string;
    gender: string;
    maritalStatus: string;
    panNumber: string;
    aadhaarNumber: string;
    mobile: string;
    email: string;
    fatherName: string;
  };
  onChange: (data: Partial<PersonalDetailsStepProps["data"]>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function PersonalDetailsStep({ data, onChange, onNext, onPrev }: PersonalDetailsStepProps) {
  const validatePAN = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
  const validateAadhaar = (aadhaar: string) => /^[0-9]{12}$/.test(aadhaar.replace(/\s/g, ""));
  const validatePhone = (phone: string) => /^[6-9][0-9]{9}$/.test(phone.replace(/\s/g, ""));
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!data.fullName.trim()) return;
    if (!validatePAN(data.panNumber)) return;
    if (!validateAadhaar(data.aadhaarNumber)) return;
    if (!validatePhone(data.mobile)) return;
    if (!validateEmail(data.email)) return;
    
    onNext();
  };

  const formatAadhaar = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Personal Information</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Enter your personal details as per government ID
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="fullName">Full Name (as per PAN) *</Label>
          <Input
            id="fullName"
            value={data.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            placeholder="Enter full name"
            required
          />
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth *</Label>
          <Input
            id="dob"
            type="date"
            value={data.dob}
            onChange={(e) => onChange({ dob: e.target.value })}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
            required
          />
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label>Gender *</Label>
          <Select value={data.gender} onValueChange={(value) => onChange({ gender: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Marital Status */}
        <div className="space-y-2">
          <Label>Marital Status *</Label>
          <Select value={data.maritalStatus} onValueChange={(value) => onChange({ maritalStatus: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="married">Married</SelectItem>
              <SelectItem value="divorced">Divorced</SelectItem>
              <SelectItem value="widowed">Widowed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Father's Name */}
        <div className="space-y-2">
          <Label htmlFor="fatherName">Father's Name</Label>
          <Input
            id="fatherName"
            value={data.fatherName}
            onChange={(e) => onChange({ fatherName: e.target.value })}
            placeholder="Enter father's name"
          />
        </div>

        {/* PAN Number */}
        <div className="space-y-2">
          <Label htmlFor="panNumber">PAN Number *</Label>
          <Input
            id="panNumber"
            value={data.panNumber}
            onChange={(e) => onChange({ panNumber: e.target.value.toUpperCase() })}
            placeholder="ABCDE1234F"
            maxLength={10}
            required
          />
          {data.panNumber && !validatePAN(data.panNumber) && (
            <p className="text-xs text-destructive">Invalid PAN format</p>
          )}
        </div>

        {/* Aadhaar Number */}
        <div className="space-y-2">
          <Label htmlFor="aadhaarNumber">Aadhaar Number *</Label>
          <Input
            id="aadhaarNumber"
            value={formatAadhaar(data.aadhaarNumber)}
            onChange={(e) => onChange({ aadhaarNumber: e.target.value.replace(/\s/g, "") })}
            placeholder="1234 5678 9012"
            maxLength={14}
            required
          />
          {data.aadhaarNumber && !validateAadhaar(data.aadhaarNumber) && (
            <p className="text-xs text-destructive">Aadhaar must be 12 digits</p>
          )}
        </div>

        {/* Mobile */}
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile Number *</Label>
          <Input
            id="mobile"
            type="tel"
            value={data.mobile}
            onChange={(e) => onChange({ mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            placeholder="9876543210"
            maxLength={10}
            required
          />
          {data.mobile && !validatePhone(data.mobile) && (
            <p className="text-xs text-destructive">Invalid mobile number</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="you@example.com"
            required
          />
          {data.email && !validateEmail(data.email) && (
            <p className="text-xs text-destructive">Invalid email format</p>
          )}
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
            !data.fullName.trim() ||
            !data.dob ||
            !data.gender ||
            !data.maritalStatus ||
            !validatePAN(data.panNumber) ||
            !validateAadhaar(data.aadhaarNumber) ||
            !validatePhone(data.mobile) ||
            !validateEmail(data.email)
          }
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
