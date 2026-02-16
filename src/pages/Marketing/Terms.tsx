import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";

export default function Terms() {
  return (
    <>
      <PageHeroBanner title="Terms &" highlightedWord="Conditions" subtitle="Please read these terms carefully before using our services" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <p>Last updated: February 2026</p>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By using Paisaa Saarthi's services, including our website and loan application platform, you agree to these terms and conditions. Please read them carefully before proceeding with any loan application.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">2. Eligibility</h2>
            <p>You must be an Indian citizen, aged 21 to 55 years, employed as a salaried individual with minimum 6 months of work experience, earning a monthly income of at least ₹15,000, and possessing a valid Aadhaar and PAN card to apply for a loan.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">3. Loan Terms</h2>
            <p>Loan amounts range from ₹5,000 to ₹1,00,000. Interest is charged at 1% per day flat rate. A processing fee of 10% of the loan amount is deducted at disbursement. Tenure ranges from 7 to 90 days. Exact terms will be communicated at the time of approval.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">4. Repayment</h2>
            <p>Borrowers must repay the loan as per the agreed schedule. Late payments may attract additional charges as specified in the loan agreement. Repeated defaults may be reported to credit bureaus.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">5. Prepayment</h2>
            <p>There is 0% prepayment penalty. You may repay your loan early at any time without additional charges.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">6. NBFC Partnership</h2>
            <p>Paisaa Saarthi operates as a digital lending platform in partnership with RBI-registered NBFCs. The actual lending is done by our NBFC partners. Paisaa Saarthi facilitates the loan origination and processing.</p>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-3">7. Governing Law</h2>
            <p>These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Noida/Delhi NCR, India.</p>
          </div>
        </div>
      </div>
    </>
  );
}
