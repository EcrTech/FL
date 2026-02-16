import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, Heart, Users } from "lucide-react";

export default function About() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">About <span className="text-primary">Paisa Saarthi</span></h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          We are on a mission to make financial services accessible, transparent, and hassle-free for everyone.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {[
          { icon: Target, title: "Our Mission", desc: "To empower individuals and small businesses with quick, transparent, and affordable credit solutions that help them achieve their financial goals." },
          { icon: Eye, title: "Our Vision", desc: "To become India's most trusted digital lending platform, known for speed, transparency, and customer satisfaction." },
          { icon: Heart, title: "Our Values", desc: "Transparency, integrity, customer-first approach, and innovation drive everything we do at Paisa Saarthi." },
          { icon: Users, title: "Our Team", desc: "A passionate team of finance professionals, technologists, and customer experience experts working together to simplify lending." },
        ].map((item) => (
          <Card key={item.title} className="border-border">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-heading font-bold text-xl text-foreground">{item.title}</h3>
              <p className="mt-2 text-muted-foreground">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
