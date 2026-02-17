import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const CONSENT_VERSION = "1.0";

interface DPDPConsentStepProps {
  orgId: string;
  userIdentifier: string;
  onConsent: () => void;
}

export function DPDPConsentStep({ orgId, userIdentifier, onConsent }: DPDPConsentStepProps) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleConsent = async () => {
    if (!agreed) return;
    setSubmitting(true);
    try {
      await supabase.from("dpdp_consent_records" as any).insert([
        {
          org_id: orgId,
          user_identifier: userIdentifier || "unknown",
          consent_version: CONSENT_VERSION,
          purpose: "loan_application_data_collection",
          ip_address: null, // Would need a service to get real IP
          user_agent: navigator.userAgent,
        },
      ]);
      onConsent();
    } catch (err) {
      console.error("Failed to record consent:", err);
      // Allow proceeding even if consent recording fails
      onConsent();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Data Protection Consent
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Under the Digital Personal Data Protection Act, 2023, we need your consent before collecting your personal data.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-64 rounded-md border p-4" ref={scrollRef}>
          <div className="space-y-4 text-sm">
            <h3 className="font-semibold">What data we collect</h3>
            <p>
              As part of your loan application, we will collect and process the following personal data:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name, email address, and phone number</li>
              <li>PAN number (for identity and tax verification)</li>
              <li>Aadhaar number (for eKYC verification)</li>
              <li>Bank account details (for disbursement and repayment)</li>
              <li>Video KYC recording (for identity verification)</li>
              <li>Geolocation (for application verification)</li>
              <li>Income and employment details</li>
            </ul>

            <h3 className="font-semibold mt-4">Why we collect it</h3>
            <p>Your data is processed for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Evaluating your loan application and creditworthiness</li>
              <li>Identity verification and fraud prevention</li>
              <li>Regulatory compliance (RBI guidelines)</li>
              <li>Loan disbursement and collections</li>
              <li>Communication about your application</li>
            </ul>

            <h3 className="font-semibold mt-4">Data retention</h3>
            <p>
              Your personal data will be retained for 7 years from the end of the business
              relationship, or as required by applicable laws.
            </p>

            <h3 className="font-semibold mt-4">Your rights</h3>
            <p>
              Under the DPDP Act, 2023, you have the right to access, correct, or erase your
              personal data, withdraw consent, and file grievances. You can exercise these rights
              through our Data Rights Request form.
            </p>

            <h3 className="font-semibold mt-4">Data Protection Officer</h3>
            <p>
              Contact: <a href="mailto:dpo@yourcompany.com" className="text-primary underline">dpo@yourcompany.com</a>
            </p>
          </div>
        </ScrollArea>

        <div className="flex items-start gap-2">
          <Checkbox
            id="dpdp-consent"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
          />
          <label htmlFor="dpdp-consent" className="text-sm leading-tight cursor-pointer">
            I freely consent to the collection and processing of my personal data as described above,
            in accordance with the Digital Personal Data Protection Act, 2023.
          </label>
        </div>

        <div className="flex items-center justify-between">
          <Link
            to="/privacy-policy"
            target="_blank"
            className="text-sm text-primary flex items-center gap-1 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View full Privacy Policy
          </Link>

          <Button onClick={handleConsent} disabled={!agreed || submitting}>
            {submitting ? "Recording consent..." : "I Agree — Continue"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Consent version {CONSENT_VERSION} — You can withdraw consent at any time.
        </p>
      </CardContent>
    </Card>
  );
}
