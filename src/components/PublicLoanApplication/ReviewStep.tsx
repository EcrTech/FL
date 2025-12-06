import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit2, Loader2 } from "lucide-react";
import type { LoanFormData } from "@/pages/PublicLoanApplication";

interface ReviewStepProps {
  formData: LoanFormData;
  onSubmit: () => void;
  onPrev: () => void;
  onEdit: (step: number) => void;
  submitting: boolean;
}

const productTypeLabels: Record<string, string> = {
  personal_loan: "Personal Loan",
  home_loan: "Home Loan",
  business_loan: "Business Loan",
  education_loan: "Education Loan",
  vehicle_loan: "Vehicle Loan",
};

export function ReviewStep({ formData, onSubmit, onPrev, onEdit, submitting }: ReviewStepProps) {
  const formatAmount = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "₹0";
    return `₹${new Intl.NumberFormat("en-IN").format(num)}`;
  };

  const formatAadhaar = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return `XXXX XXXX ${digits.slice(-4)}`;
  };

  const Section = ({ 
    title, 
    step, 
    children 
  }: { 
    title: string; 
    step: number; 
    children: React.ReactNode;
  }) => (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(step)}
          disabled={submitting}
        >
          <Edit2 className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "-"}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Review Your Application</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Please verify all details before submitting
        </p>
      </div>

      {/* Loan Details */}
      <Section title="Loan Details" step={1}>
        <Field 
          label="Loan Type" 
          value={productTypeLabels[formData.loanDetails.productType] || formData.loanDetails.productType} 
        />
        <Field label="Loan Amount" value={formatAmount(formData.loanDetails.amount)} />
        <Field label="Tenure" value={`${formData.loanDetails.tenure} days`} />
      </Section>

      {/* Personal Details */}
      <Section title="Personal Information" step={2}>
        <Field label="Full Name" value={formData.personalDetails.fullName} />
        <Field label="Date of Birth" value={formData.personalDetails.dob} />
        <Field 
          label="Gender" 
          value={formData.personalDetails.gender.charAt(0).toUpperCase() + formData.personalDetails.gender.slice(1)} 
        />
        <Field 
          label="Marital Status" 
          value={formData.personalDetails.maritalStatus.charAt(0).toUpperCase() + formData.personalDetails.maritalStatus.slice(1)} 
        />
        <Field label="PAN Number" value={formData.personalDetails.panNumber} />
        <Field label="Aadhaar Number" value={formatAadhaar(formData.personalDetails.aadhaarNumber)} />
        <Field label="Mobile" value={formData.personalDetails.mobile} />
        <Field label="Email" value={formData.personalDetails.email} />
      </Section>

      {/* Address Details */}
      <Section title="Address" step={3}>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Current Address</p>
          <p className="font-medium">
            {formData.addressDetails.currentAddress.addressLine1}
            {formData.addressDetails.currentAddress.addressLine2 && `, ${formData.addressDetails.currentAddress.addressLine2}`}
            <br />
            {formData.addressDetails.currentAddress.city}, {formData.addressDetails.currentAddress.state} - {formData.addressDetails.currentAddress.pincode}
          </p>
        </div>
        {!formData.addressDetails.sameAsCurrent && (
          <div className="pt-2 border-t">
            <p className="text-muted-foreground text-xs mb-1">Permanent Address</p>
            <p className="font-medium">
              {formData.addressDetails.permanentAddress.addressLine1}
              {formData.addressDetails.permanentAddress.addressLine2 && `, ${formData.addressDetails.permanentAddress.addressLine2}`}
              <br />
              {formData.addressDetails.permanentAddress.city}, {formData.addressDetails.permanentAddress.state} - {formData.addressDetails.permanentAddress.pincode}
            </p>
          </div>
        )}
      </Section>

      {/* Employment Details */}
      <Section title="Employment" step={4}>
        <Field 
          label="Employment Type" 
          value={formData.employmentDetails.employmentType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} 
        />
        <Field label="Employer" value={formData.employmentDetails.employerName} />
        <Field label="Designation" value={formData.employmentDetails.designation} />
        <Field label="Gross Monthly Income" value={formatAmount(formData.employmentDetails.grossSalary)} />
        <Field label="Net Monthly Income" value={formatAmount(formData.employmentDetails.netSalary)} />
        <Field label="Salary Bank" value={formData.employmentDetails.bankName} />
      </Section>

      {/* Documents */}
      <Section title="Documents" step={5}>
        {formData.documents.length > 0 ? (
          <div className="space-y-1">
            {formData.documents.map((doc, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span>{doc.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                <span className="text-muted-foreground text-xs">({doc.name})</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No documents uploaded</p>
        )}
      </Section>

      {/* Terms */}
      <div className="p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <p>
          By submitting this application, I confirm that all information provided is accurate and complete. 
          I authorize the verification of my details and consent to being contacted regarding this loan application.
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onPrev} 
          className="flex-1"
          disabled={submitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={onSubmit} 
          className="flex-1"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Application"
          )}
        </Button>
      </div>
    </div>
  );
}
