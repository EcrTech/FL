import { CheckCircle } from "lucide-react";

interface HeroSectionProps {
  referrerName?: string;
}

export function HeroSection({ referrerName }: HeroSectionProps) {
  const benefits = [
    "Instant Approval",
    "Minimal Documentation",
    "Flexible Repayment",
    "Doorstep Service",
  ];

  return (
    <div className="relative h-full bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex flex-col justify-center p-8 lg:p-12 overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
      <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-accent/20 rounded-full" />

      <div className="relative z-10">
        {referrerName && (
          <div className="inline-block bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm mb-6">
            Referred by <span className="font-semibold">{referrerName}</span>
          </div>
        )}

        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 leading-tight">
          Get Instant Loan<br />
          up to <span className="text-accent">₹5 Lakhs</span>
        </h1>

        <p className="text-white/80 text-lg mb-8 max-w-md">
          Quick approval, minimal documentation, and competitive interest rates for all your financial needs.
        </p>

        <div className="space-y-3">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-accent" />
              <span className="text-white font-medium">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/20">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-white/30 border-2 border-white flex items-center justify-center text-white font-semibold text-sm"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <div className="text-white">
              <div className="font-bold">50,000+</div>
              <div className="text-sm text-white/70">Happy Customers</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
