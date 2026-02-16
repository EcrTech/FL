import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, UserCheck, Video, CreditCard } from "lucide-react";

const steps = [
  { icon: FileText, step: "1", title: "Fill Application", desc: "Provide your basic details — name, phone, Aadhaar, PAN, and loan amount needed." },
  { icon: UserCheck, step: "2", title: "KYC Verification", desc: "Complete your Aadhaar-based eKYC and upload a selfie for identity verification." },
  { icon: Video, step: "3", title: "Video KYC", desc: "A short video call to verify your identity. Quick and hassle-free!" },
  { icon: CreditCard, step: "4", title: "Loan Disbursal", desc: "Once approved, the loan amount is disbursed directly to your bank account." },
];

export default function HowToApply() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">How to <span className="text-primary">Apply</span></h1>
        <p className="mt-4 text-lg text-muted-foreground">Get your loan in 4 simple steps.</p>
      </div>

      <div className="space-y-8">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-6 items-start">
            <div className="shrink-0 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-xl">
              {s.step}
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                <s.icon className="h-5 w-5 text-primary" /> {s.title}
              </h3>
              <p className="mt-1 text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-12">
        <Button asChild size="lg">
          <Link to="/apply">Apply Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
        </Button>
      </div>
    </div>
  );
}
