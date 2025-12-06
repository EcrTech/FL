import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/common/LoadingState";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, QrCode, Link2, Users, Eye } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const REFERRAL_BASE_URL = "https://ps.in-sync.co.in/apply/ref";

export default function MyReferrals() {
  const { orgId } = useOrgContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Fetch or create referral code
  const { data: referralData, isLoading: referralLoading } = useQuery({
    queryKey: ["my-referral-code", userId, orgId],
    queryFn: async () => {
      // First try to get existing code
      const { data: existing } = await supabase
        .from("user_referral_codes")
        .select("*")
        .eq("user_id", userId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (existing) return existing;

      // Generate new code using database function
      const { data: codeResult } = await supabase.rpc("generate_referral_code", {
        p_user_id: userId,
      });

      // Create new referral code record
      const { data: newCode, error } = await supabase
        .from("user_referral_codes")
        .insert({
          user_id: userId,
          org_id: orgId,
          referral_code: codeResult || `REF-${Date.now().toString(36).toUpperCase()}`,
        })
        .select()
        .single();

      if (error) throw error;
      return newCode;
    },
    enabled: !!userId && !!orgId,
  });

  // Fetch referred applications
  const { data: referredApps = [], isLoading: appsLoading } = useQuery({
    queryKey: ["referred-applications", userId, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          id,
          application_number,
          requested_amount,
          status,
          current_stage,
          created_at,
          loan_applicants(first_name, last_name)
        `)
        .eq("org_id", orgId)
        .eq("referred_by", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!orgId,
  });

  const referralLink = referralData?.referral_code
    ? `${REFERRAL_BASE_URL}/${referralData.referral_code}`
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted",
      in_progress: "bg-blue-500",
      approved: "bg-green-500",
      rejected: "bg-red-500",
      disbursed: "bg-purple-500",
    };
    return colors[status] || "bg-muted";
  };

  if (referralLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading your referral info..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Referral Link</h1>
          <p className="text-muted-foreground mt-1">
            Share your unique link to refer loan applicants
          </p>
        </div>

        
        <div className="grid gap-6 md:grid-cols-2">
          {/* QR Code Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Your QR Code
              </CardTitle>
              <CardDescription>
                Scan this QR code to apply for a loan
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG
                  value={referralLink}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground text-center">
                Code: <span className="font-mono font-bold">{referralData?.referral_code}</span>
              </p>
            </CardContent>
          </Card>

          {/* Shareable Link Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Your Referral Link
              </CardTitle>
              <CardDescription>
                Share this link with prospective applicants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={handleCopyLink} variant="outline">
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">How it works:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Share your unique link or QR code</li>
                  <li>Applicant fills out the loan application</li>
                  <li>Application is automatically linked to you</li>
                  <li>Track all your referrals here</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referred Applications */}
        <Card>
          <CardHeader>
            <CardTitle>Your Referred Applications</CardTitle>
            <CardDescription>
              {referredApps.length} application{referredApps.length !== 1 ? "s" : ""} referred by you
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appsLoading ? (
              <LoadingState message="Loading applications..." />
            ) : referredApps.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No referrals yet</h3>
                <p className="text-muted-foreground">
                  Share your link to start referring loan applicants
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {referredApps.map((app: any) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/los/applications/${app.id}`)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold">{app.application_number}</span>
                        <Badge className={getStatusColor(app.status)}>
                          {app.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {app.loan_applicants?.[0]
                          ? `${app.loan_applicants[0].first_name} ${app.loan_applicants[0].last_name || ""}`
                          : "Applicant"}{" "}
                        • {formatCurrency(app.requested_amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Applied {format(new Date(app.created_at), "MMM dd, yyyy")}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}