

# Fix Marketing Page Text to Match PaisaaSaarthi.com Exactly

## Problem
The design/styling matches but the text content on several pages differs from the live paisaasaarthi.com website. The biggest mismatches are on Privacy and Terms (completely different content), with a minor CTA text difference on About.

## Pages That Need Changes

### 1. Privacy Policy (`src/pages/Marketing/Privacy.tsx`) -- FULL REWRITE
**Current**: Generic 6-section privacy policy with simplified text.
**Live site**: Detailed 10-section DPDPA 2023 compliant privacy policy with:
- Section 1: Introduction (mentions Skyrise Credit and Marketing Limited, RBI, DPDPA 2023)
- Section 2: Data We Collect (6 categories: Identification, Contact, Financial, Device & Usage, Loan Application, Third-Party)
- Section 3: Purpose of Use (6 bullet points)
- Section 4: Data Sharing & Third Parties (4 categories with bold labels)
- Section 5: Consent, Control & Withdrawal
- Section 6: Data Security & Retention (AES-256, TLS/HTTPS, etc.)
- Section 7: Your Rights (DPDPA 2023 rights, Data Protection Officer details: Mr. Abhishek, phone 78384 09079)
- Section 8: Children's Privacy
- Section 9: Policy Updates
- Section 10: Regulatory Compliance (RBI Digital Lending Directions 2025, DPDP Act 2023, IT Act 2000, PMLA)
- Footer CTA: "Questions About Your Data?" with Apply Now and Contact DPO buttons
- Effective date: 18-02-2025, DPDPA 2023 Compliant badge

### 2. Terms & Conditions (`src/pages/Marketing/Terms.tsx`) -- FULL REWRITE
**Current**: Generic 7-section terms with simplified text about eligibility, loan terms, repayment, prepayment, NBFC partnership, governing law.
**Live site**: 9-section terms with specific legal language:
- Section 1: Service Overview (mentions Skyrise Credit and Marketing Limited, RBI-registered NBFC, clarifies LSP role)
- Section 2: Eligibility (Indian resident, 18+, valid KYC, creditworthiness)
- Section 3: Loan Terms (Key Fact Statement/KFS, RBI Digital Lending Directions)
- Section 4: User Obligations (3 bullet points)
- Section 5: Liability & Limitations
- Section 6: Data Usage & Privacy
- Section 7: Dispute Resolution & Support (info@paisaasaarthi.com, grievance@paisaasaarthi.com)
- Section 8: Amendments
- Section 9: Licensing & Compliance (Skyrise Credit, Companies Act 2013)
- Footer CTA: "Ready to Apply for a Loan?" with Apply Now button
- Effective Date: 01-02-2026

### 3. About (`src/pages/Marketing/About.tsx`) -- MINOR FIX
**Current CTA text**: "Start your loan application today and experience the PaisaaSaarthi difference."
**Live site CTA text**: "Experience the Paisaa Saarthi difference. Quick loans, transparent terms, and a team that truly cares about your financial well-being."

### 4. PageHeroBanner for Privacy -- UPDATE
**Current**: title="Privacy" highlightedWord="Policy"
**Live site header**: Shows "Your Data, Protected" above the title, subtitle "How we collect, use, and protect your personal information"
- The banner text needs to match the live site exactly.

## Technical Details

### Files to modify:
1. **`src/pages/Marketing/Privacy.tsx`** -- Complete rewrite with all 10 sections, exact text from live site, proper section numbering with styled number badges, DPO contact card, regulatory compliance list, and CTA footer
2. **`src/pages/Marketing/Terms.tsx`** -- Complete rewrite with all 9 sections, exact legal text from live site, proper section numbering, grievance email, and CTA footer
3. **`src/pages/Marketing/About.tsx`** -- Update CTA paragraph text (line 92) to match live site exactly

### No new dependencies or database changes needed.

