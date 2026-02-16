import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";

export default function Privacy() {
  return (
    <>
      <PageHeroBanner title="Privacy" highlightedWord="Policy" subtitle="How we collect, use, and protect your information" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <p>Last updated: February 2026</p>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">1. Information We Collect</h2>
            <p>We collect personal information such as your name, phone number, email, Aadhaar number, PAN, address, employment details, and financial information necessary for processing your loan application. This includes data provided directly by you and data obtained through verification services.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">2. How We Use Your Information</h2>
            <p>Your information is used to verify your identity, assess loan eligibility, process loan disbursals, communicate with you about your application, improve our services, and comply with legal and regulatory requirements.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">3. Data Security</h2>
            <p>We employ 256-bit SSL encryption and industry-standard security measures to protect your personal and financial data from unauthorized access, disclosure, or misuse. Our systems are regularly audited for security compliance.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">4. Data Sharing</h2>
            <p>We do not sell your personal data to third parties. We may share information with our NBFC lending partners, KYC verification agencies, credit bureaus, and government authorities as required by law and for the purpose of loan processing.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">5. Your Rights</h2>
            <p>You have the right to access, correct, or request deletion of your personal data. You may also withdraw consent for data processing, subject to legal and contractual obligations. Contact us at info@paisaasaarthi.com for any data-related requests.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">6. Contact</h2>
            <p>For privacy concerns, email us at info@paisaasaarthi.com or call +91 79-82012776. Our address: Paisaa Saarthi, Office no. 110, 1st floor, H-161, BSI Business Park Sec-63, Noida, UP-201301.</p>
          </div>
        </div>
      </div>
    </>
  );
}
