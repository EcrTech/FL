import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, UserPlus, LinkIcon } from "lucide-react";

export default function Apply() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">Apply for a <span className="text-primary">Loan</span></h1>
        <p className="mt-4 text-lg text-muted-foreground">Choose how you'd like to get started.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border card-hover-lift">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <LinkIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-heading font-bold text-lg text-foreground">Via Referral Link</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              If you have a referral link from one of our agents, use it to start your application directly.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border card-hover-lift">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserPlus className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-heading font-bold text-lg text-foreground">Contact Us</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Don't have a referral link? Contact us and our team will assist you with the application process.
            </p>
            <Button asChild variant="default" size="sm" className="mt-4">
              <Link to="/contact">Get in Touch <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
