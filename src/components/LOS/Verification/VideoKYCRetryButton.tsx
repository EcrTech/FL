import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Link, Loader2, CheckCircle, Video, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface VideoKYCRetryButtonProps {
  applicationId: string;
  orgId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  onSuccess?: () => void;
}

export function VideoKYCRetryButton({
  applicationId,
  orgId,
  applicantName,
  applicantPhone,
  applicantEmail,
  onSuccess,
}: VideoKYCRetryButtonProps) {
  const [open, setOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Check if there's an existing pending link
  const { data: existingRecording } = useQuery({
    queryKey: ["videokyc-recording", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videokyc_recordings")
        .select("*")
        .eq("application_id", applicationId)
        .eq("status", "pending")
        .gt("token_expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("videokyc-create-retry-link", {
        body: {
          application_id: applicationId,
          org_id: orgId,
          applicant_name: applicantName,
          applicant_phone: applicantPhone,
          applicant_email: applicantEmail,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedLink(data.shareable_url);
      toast.success("Video KYC link generated successfully");
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error creating link:", error);
      toast.error("Failed to create Video KYC link");
    },
  });

  const copyToClipboard = async () => {
    const linkToCopy = generatedLink || (existingRecording ? `${window.location.origin}/videokyc/${existingRecording.access_token}` : null);
    
    if (linkToCopy) {
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setGeneratedLink(null);
      setCopied(false);
    }
  };

  const existingLink = existingRecording ? `${window.location.origin}/videokyc/${existingRecording.access_token}` : null;
  const displayLink = generatedLink || existingLink;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Link className="h-4 w-4" />
        Generate Retry Link
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video KYC Retry Link
            </DialogTitle>
            <DialogDescription>
              Generate a shareable link for the applicant to complete their Video KYC.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Applicant</Label>
              <p className="text-sm font-medium">{applicantName}</p>
              {applicantPhone && (
                <p className="text-sm text-muted-foreground">{applicantPhone}</p>
              )}
            </div>

            {displayLink ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-800 dark:text-green-200">
                    {existingLink && !generatedLink ? "Existing link found" : "Link generated successfully"}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label>Shareable Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={displayLink}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyToClipboard}
                      className="shrink-0"
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  This link expires in 24 hours from creation.
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(displayLink, "_blank")}
                    className="flex-1"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Link
                  </Button>
                  {existingLink && !generatedLink && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => createLinkMutation.mutate()}
                      disabled={createLinkMutation.isPending}
                      className="flex-1"
                    >
                      {createLinkMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Generate New Link"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button
                onClick={() => createLinkMutation.mutate()}
                disabled={createLinkMutation.isPending}
                className="w-full"
              >
                {createLinkMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Generate Video KYC Link
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
