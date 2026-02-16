import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, User, GraduationCap, Home, Stethoscope, Car } from "lucide-react";

const services = [
  { icon: User, title: "Personal Loan", desc: "Quick personal loans from ₹5,000 to ₹1,00,000 for your immediate needs.", rate: "Starting 1%/day" },
  { icon: Briefcase, title: "Business Loan", desc: "Fund your business growth with flexible loan amounts and easy repayment.", rate: "Competitive rates" },
  { icon: GraduationCap, title: "Education Loan", desc: "Invest in your future with affordable education financing options.", rate: "Special rates" },
  { icon: Stethoscope, title: "Medical Emergency", desc: "Instant funds for medical emergencies when you need them most.", rate: "Fast approval" },
  { icon: Home, title: "Home Improvement", desc: "Renovate or repair your home with our home improvement loans.", rate: "Flexible terms" },
  { icon: Car, title: "Vehicle Loan", desc: "Get on the road with easy two-wheeler and four-wheeler financing.", rate: "Low EMI" },
];

export default function Services() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">Our <span className="text-primary">Services</span></h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          We offer a range of loan products tailored to your specific needs.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((s) => (
          <Card key={s.title} className="card-hover-lift border-border">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-heading font-bold text-lg text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              <span className="inline-block mt-3 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">{s.rate}</span>
            </CardContent>
          </Card>
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
