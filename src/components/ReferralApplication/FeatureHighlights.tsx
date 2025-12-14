import { Percent, IndianRupee, Clock, Ban } from "lucide-react";

export function FeatureHighlights() {
  const features = [
    {
      icon: Percent,
      text: "Starting from 12.65% p.a.",
    },
    {
      icon: IndianRupee,
      text: "No Hidden Charges",
    },
    {
      icon: Clock,
      text: "Quick Process",
    },
    {
      icon: Ban,
      text: "0% Pre-payment Penalty",
    },
  ];

  return (
    <div className="bg-primary/5 border-t border-border py-4 px-6">
      <div className="flex flex-wrap justify-center gap-6 md:gap-12">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <feature.icon className="h-5 w-5 text-primary" />
            <span className="text-foreground font-medium">{feature.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
