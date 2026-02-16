import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Shield, Clock, IndianRupee, Users, CheckCircle, Percent } from "lucide-react";

const features = [
  { icon: Percent, title: "Competitive Rates", desc: "Starting at just 1% per day flat rate with no hidden charges" },
  { icon: Clock, title: "Quick Disbursal", desc: "Get your loan disbursed within 24-48 hours of approval" },
  { icon: Shield, title: "100% Transparent", desc: "No hidden fees, no surprises — everything upfront" },
  { icon: IndianRupee, title: "Flexible Amounts", desc: "Borrow from ₹5,000 to ₹1,00,000 based on your needs" },
];

const stats = [
  { value: "10,000+", label: "Happy Customers" },
  { value: "₹50Cr+", label: "Loans Disbursed" },
  { value: "24hrs", label: "Avg. Disbursal Time" },
  { value: "4.8★", label: "Customer Rating" },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold text-foreground leading-tight">
            Your Trusted Partner for
            <span className="text-primary block">Quick Personal Loans</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Get instant loans from ₹5,000 to ₹1,00,000 with minimal documentation, transparent terms, and lightning-fast disbursals.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-base px-8">
              <Link to="/apply">Apply Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8">
              <Link to="/how-to-apply">How It Works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary text-primary-foreground py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-heading text-3xl md:text-4xl font-extrabold">{s.value}</div>
                <div className="text-sm mt-1 opacity-80">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-center text-foreground">
            Why Choose <span className="text-primary">Paisa Saarthi?</span>
          </h2>
          <p className="mt-4 text-center text-muted-foreground max-w-xl mx-auto">
            We make borrowing simple, fast, and transparent.
          </p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="card-hover-lift border-border">
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <f.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-muted py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground">Trusted by Thousands</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Rahul S.", text: "Got my loan within 24 hours. The process was incredibly smooth!" },
              { name: "Priya M.", text: "No hidden charges — exactly what they promised. Highly recommended." },
              { name: "Amit K.", text: "The customer support team was very helpful throughout the process." },
            ].map((t) => (
              <Card key={t.name} className="border-border">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-3 text-primary">
                    {[...Array(5)].map((_, i) => <CheckCircle key={i} className="h-4 w-4" />)}
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
                  <p className="mt-3 font-semibold text-foreground text-sm">{t.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">Ready to Get Started?</h2>
          <p className="mt-4 text-muted-foreground">Apply in just a few minutes and get your loan approved fast.</p>
          <Button asChild size="lg" className="mt-8 text-base px-10">
            <Link to="/apply">Apply for a Loan <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
