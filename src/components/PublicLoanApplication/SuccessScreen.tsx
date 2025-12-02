import { CheckCircle, Copy, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface SuccessScreenProps {
  applicationNumber: string;
}

export function SuccessScreen({ applicationNumber }: SuccessScreenProps) {
  const copyApplicationNumber = () => {
    navigator.clipboard.writeText(applicationNumber);
    toast({
      title: "Copied!",
      description: "Application number copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8 px-4 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            Application Submitted!
          </h1>
          <p className="text-muted-foreground mb-6">
            Your loan application has been received successfully. Our team will review your application and contact you soon.
          </p>

          {/* Application Number */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Application Number</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl font-mono font-bold tracking-wider">
                {applicationNumber}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyApplicationNumber}
                className="h-8 w-8 p-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Please save this number for future reference
            </p>
          </div>

          {/* Next Steps */}
          <div className="text-left mb-6">
            <h3 className="font-medium mb-3">What happens next?</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-medium text-foreground">1.</span>
                Our team will verify your documents within 24-48 hours
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">2.</span>
                You'll receive a call to discuss your loan requirements
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">3.</span>
                Upon approval, the loan amount will be disbursed to your account
              </li>
            </ol>
          </div>

          {/* Contact Info */}
          <div className="border-t pt-6">
            <p className="text-sm text-muted-foreground mb-3">
              Need help? Contact us
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" size="sm" asChild>
                <a href="tel:+919876543210">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Support
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="mailto:support@example.com">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Us
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
