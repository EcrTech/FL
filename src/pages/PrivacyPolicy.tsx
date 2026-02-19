import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ExternalLink } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
        </div>

        <Card>
          <CardContent className="prose prose-sm max-w-none p-6 space-y-6">
            <p className="text-sm text-muted-foreground">
              Last updated: February 2026 | Effective under the Digital Personal Data Protection Act, 2023
            </p>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">1. Data Fiduciary</h2>
              <p>
                This platform is operated by the organization registered on the system (the "Data Fiduciary").
                For questions regarding data protection, contact our Data Protection Officer at{" "}
                <a href="mailto:dpo@in-sync.co.in" className="text-primary underline">dpo@in-sync.co.in</a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">2. Personal Data Collected</h2>
              <p>We collect and process the following categories of personal data:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Contact Information:</strong> Name, phone number, email address</li>
                <li><strong>Loan Application Data:</strong> Mobile number, email, Aadhaar number, PAN number, bank account number, IFSC code, alternate mobile number</li>
                <li><strong>Identity Verification:</strong> Aadhaar-based eKYC, PAN verification, Video KYC recordings</li>
                <li><strong>Financial Information:</strong> Income details, bank statements, credit bureau reports</li>
                <li><strong>Location Data:</strong> Geolocation during loan application (with consent)</li>
                <li><strong>Technical Data:</strong> IP address, browser user agent, device information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">3. Purpose of Data Collection</h2>
              <p>Your personal data is processed for the following purposes:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Processing and evaluating loan applications</li>
                <li>Identity verification and fraud prevention</li>
                <li>Credit assessment and risk evaluation</li>
                <li>Loan disbursement and collections management</li>
                <li>Regulatory compliance and reporting</li>
                <li>Communication regarding your application and account</li>
                <li>Customer relationship management</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">4. Legal Basis for Processing</h2>
              <p>
                In accordance with <strong>Section 6 of the DPDP Act, 2023</strong>, we process your personal data based on:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Explicit Consent:</strong> Your freely given, specific, informed, and unambiguous consent obtained before data collection</li>
                <li><strong>Legitimate Uses:</strong> As specified in Section 7 of the Act for compliance with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">5. Data Retention</h2>
              <p>
                Personal data is retained for <strong>7 years</strong> from the end of the business relationship,
                or as required by applicable laws and regulations (including RBI guidelines). After the retention
                period, data is securely erased unless continued retention is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">6. Your Rights as a Data Principal</h2>
              <p>Under the DPDP Act, 2023, you have the following rights:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Right to Access (Section 11):</strong> Request a summary of your personal data and processing activities</li>
                <li><strong>Right to Correction (Section 12):</strong> Request correction of inaccurate or incomplete data</li>
                <li><strong>Right to Erasure (Section 12):</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
                <li><strong>Right to Withdraw Consent (Section 6):</strong> Withdraw your consent at any time (this does not affect lawfulness of prior processing)</li>
                <li><strong>Right to Nominate (Section 14):</strong> Nominate another person to exercise your rights in case of death or incapacity</li>
                <li><strong>Right to Grievance Redressal (Section 13):</strong> File a grievance regarding data processing</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, please submit a request through our{" "}
                <Link to="/data-rights-request" className="text-primary underline">Data Rights Request Form</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">7. Data Security Measures</h2>
              <p>We implement the following technical and organizational security measures:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Encryption:</strong> PII fields are encrypted at rest using AES-256 (PGP symmetric encryption)</li>
                <li><strong>Access Control:</strong> Role-Based Access Control (RBAC) with Row Level Security (RLS)</li>
                <li><strong>Audit Logging:</strong> All PII access events are logged in an immutable audit trail</li>
                <li><strong>Data Masking:</strong> Plaintext PII fields are automatically masked in the database</li>
                <li><strong>Secure Decryption:</strong> PII decryption requires authentication and generates audit records</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">8. Data Breach Notification</h2>
              <p>
                In the event of a personal data breach, we will notify the Data Protection Board of India
                and affected Data Principals as required under <strong>Section 8 of the DPDP Act, 2023</strong>,
                in the form and manner prescribed by the Board.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">9. Contact Information</h2>
              <p>
                <strong>Data Protection Officer:</strong>{" "}
                <a href="mailto:dpo@in-sync.co.in" className="text-primary underline">dpo@in-sync.co.in</a>
              </p>
              <p className="mt-2">
                If you are not satisfied with our response to your grievance, you may escalate your complaint
                to the <strong>Data Protection Board of India</strong> as established under Section 18 of the DPDP Act, 2023.
              </p>
            </section>

            <div className="mt-8 pt-6 border-t">
              <Link to="/data-rights-request">
                <Button>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Submit a Data Rights Request
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
