import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Contact() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">Contact <span className="text-primary">Us</span></h1>
        <p className="mt-4 text-lg text-muted-foreground">We'd love to hear from you. Reach out anytime.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Contact Info */}
        <div className="space-y-6">
          {[
            { icon: Mail, title: "Email", detail: "info@paisasaarthi.com" },
            { icon: Phone, title: "Phone", detail: "+91 98765 43210" },
            { icon: MapPin, title: "Office", detail: "Mumbai, Maharashtra, India" },
          ].map((item) => (
            <Card key={item.title} className="border-border">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact Form */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-heading">Send us a Message</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label htmlFor="name">Name</Label><Input id="name" placeholder="Your name" /></div>
                <div><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="you@example.com" /></div>
              </div>
              <div><Label htmlFor="phone">Phone</Label><Input id="phone" placeholder="+91 XXXXX XXXXX" /></div>
              <div><Label htmlFor="message">Message</Label><Textarea id="message" placeholder="How can we help?" rows={4} /></div>
              <Button type="submit" className="w-full">Send Message</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
