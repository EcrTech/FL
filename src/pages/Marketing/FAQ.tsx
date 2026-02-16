import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "What is the loan amount range?", a: "We offer loans from ₹5,000 to ₹1,00,000 depending on your eligibility and requirements." },
  { q: "What documents are required?", a: "You need a valid Aadhaar card, PAN card, and a recent photograph. The process is mostly digital with minimal paperwork." },
  { q: "How long does approval take?", a: "Most applications are reviewed and approved within 24 hours. Disbursal typically happens within 24-48 hours of approval." },
  { q: "What are the interest rates?", a: "Our rates start at 1% per day flat rate. The exact rate depends on the loan amount, tenure, and your profile." },
  { q: "Is there a prepayment penalty?", a: "No! We have a 0% prepayment penalty. You can repay your loan early without any extra charges." },
  { q: "How do I apply?", a: "You can apply online through our website or via a referral link shared by our agents. The process is 100% digital." },
  { q: "What if I miss an EMI?", a: "We recommend contacting our support team immediately. Late payment charges may apply as per the loan agreement." },
  { q: "Is my data safe?", a: "Absolutely. We use bank-grade encryption and follow strict data privacy regulations to protect your information." },
];

export default function FAQ() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">Frequently Asked <span className="text-primary">Questions</span></h1>
        <p className="mt-4 text-lg text-muted-foreground">Everything you need to know about our loan services.</p>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4">
            <AccordionTrigger className="font-heading font-semibold text-foreground text-left">{faq.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
