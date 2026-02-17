import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const REQUEST_TYPES = [
  { value: "access", label: "Data Access — Get a copy of my personal data" },
  { value: "correction", label: "Data Correction — Fix inaccurate data" },
  { value: "erasure", label: "Data Erasure — Delete my personal data" },
  { value: "grievance", label: "Grievance — File a complaint about data handling" },
];

export default function DataRightsRequest() {
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org") || undefined;
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    requester_name: "",
    requester_email: "",
    requester_phone: "",
    request_type: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.request_type) {
      toast.error("Please select a request type");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("dpdp_data_requests" as any).insert([
        {
          org_id: orgId || "00000000-0000-0000-0000-000000000000",
          requester_name: form.requester_name,
          requester_email: form.requester_email,
          requester_phone: form.requester_phone || null,
          request_type: form.request_type,
          description: form.description || null,
        },
      ]);
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error("Failed to submit request. Please try again.");
      console.error("Data rights request error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold">Request Submitted</h2>
            <p className="text-muted-foreground">
              Your data rights request has been received. We will process it within 90 days
              as required by the DPDP Act, 2023. You will receive updates at the email address provided.
            </p>
            <p className="text-sm text-muted-foreground">
              For questions, contact our DPO at{" "}
              <a href="mailto:dpo@yourcompany.com" className="text-primary underline">dpo@yourcompany.com</a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/privacy-policy" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Privacy Policy
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Data Rights Request</h1>
            <p className="text-muted-foreground">
              Exercise your rights under the Digital Personal Data Protection Act, 2023
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit Your Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={form.requester_name}
                  onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={form.requester_email}
                  onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  value={form.requester_phone}
                  onChange={(e) => setForm({ ...form, requester_phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>

              <div>
                <Label>Request Type *</Label>
                <Select
                  value={form.request_type}
                  onValueChange={(v) => setForm({ ...form, request_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select the type of request" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Provide details about your request..."
                  rows={4}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p>
                  Under the DPDP Act, 2023, your request will be processed within <strong>90 days</strong>.
                  We may contact you to verify your identity before processing.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
