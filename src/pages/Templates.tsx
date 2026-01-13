import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { MessageSquare, RefreshCw, Plus, Mail, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { StandardEmailTemplateDialog } from "@/components/Templates/StandardEmailTemplateDialog";

interface WhatsAppTemplate {
  id: string;
  template_id: string;
  template_name: string;
  template_type: string;
  category: string;
  language: string;
  content: string;
  variables: Array<{ index: number; name: string }> | null;
  status: string;
  submission_status: string;
  rejection_reason: string | null;
  last_synced_at: string;
  submitted_at: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  design_json: any;
  html_content: string;
  created_at: string;
  updated_at: string;
}

const Templates = () => {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const [syncing, setSyncing] = useState(false);
  const [submittingTemplateId, setSubmittingTemplateId] = useState<string | null>(null);
  const [queuedJobId, setQueuedJobId] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("whatsapp");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<EmailTemplate | null>(null);
  const queryClient = useQueryClient();

  // Real-time sync for queue updates
  useRealtimeSync({
    table: 'operation_queue',
    filter: queuedJobId ? `id=eq.${queuedJobId}` : undefined,
    enabled: !!queuedJobId,
    onUpdate: (payload) => {
      const newStatus = payload.new.status;
      setQueueStatus(newStatus);

      if (newStatus === 'completed') {
        notify.success("Sync Complete", "Templates have been synced successfully");
        setQueuedJobId(null);
        setQueueStatus(null);
        setSyncing(false);
        // React Query will refetch automatically
      } else if (newStatus === 'failed') {
        notify.error("Sync Failed", payload.new.error || "Failed to sync templates");
        setQueuedJobId(null);
        setQueueStatus(null);
        setSyncing(false);
      }
    },
  });

  const { data: whatsappTemplates = [], isLoading: loadingWhatsApp } = useQuery({
    queryKey: ['whatsapp-templates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_templates")
        .select("*")
        .eq("org_id", orgId)
        .order("template_name");

      if (error) throw error;
      return (data || []) as unknown as WhatsAppTemplate[];
    },
    enabled: !!orgId,
  });

  const { data: emailTemplates = [], isLoading: loadingEmail, refetch: refetchEmailTemplates } = useQuery({
    queryKey: ['email-templates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const loading = loadingWhatsApp || loadingEmail;

  const handleSync = async () => {
    // Refresh template list from database
    setSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates', orgId] });
      notify.success("Refreshed", "Template list refreshed from database");
    } catch (error) {
      notify.error("Error", "Failed to refresh templates");
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmitToExotel = async (template: WhatsAppTemplate) => {
    if (!template.id) return;
    
    setSubmittingTemplateId(template.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        'submit-whatsapp-template',
        {
          body: {
            templateId: template.id,
            orgId: orgId,
          },
        }
      );

      if (error) {
        notify.error("Submission Failed", error.message || "Failed to submit template to Exotel");
        return;
      }

      if (data?.success) {
        notify.success("Submitted", "Template submitted to Exotel for WhatsApp approval");
        // Refresh templates to show updated status
        queryClient.invalidateQueries({ queryKey: ['whatsapp-templates', orgId] });
      } else {
        notify.error("Submission Failed", data?.error || "Failed to submit template. Check WhatsApp Settings.");
      }
    } catch (error: any) {
      console.error('Error submitting template:', error);
      notify.error("Error", error.message || "Failed to submit template");
    } finally {
      setSubmittingTemplateId(null);
    }
  };

  const handleCreateEmail = () => {
    setSelectedEmailTemplate(null);
    setEmailDialogOpen(true);
  };

  const handleEditEmail = (template: EmailTemplate) => {
    setSelectedEmailTemplate(template);
    setEmailDialogOpen(true);
  };

  const handleDeleteEmail = async (templateId: string) => {
    if (!notify.confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: false })
        .eq("id", templateId);

      if (error) throw error;

      notify.success("Success", "Template deleted successfully");
      refetchEmailTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      notify.error("Error", "Failed to delete template");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "default";
      case "pending":
      case "pending_submission":
        return "secondary";
      case "rejected":
        return "destructive";
      case "synced":
        return "outline";
      case "draft":
        return "outline";
      default:
        return "outline";
    }
  };

  const getSubmissionStatusLabel = (template: WhatsAppTemplate) => {
    const status = template.submission_status?.toLowerCase();
    switch (status) {
      case "draft":
        return "Not Submitted";
      case "pending_submission":
        return "Ready to Submit";
      case "synced":
        return "Submitted to Exotel";
      case "rejected":
        return "Submission Failed";
      default:
        return status || "Unknown";
    }
  };

  const canSubmitToExotel = (template: WhatsAppTemplate) => {
    const status = template.submission_status?.toLowerCase();
    return status === "draft" || status === "pending_submission" || status === "rejected";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading templates..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {queueStatus === 'queued' && (
          <Card className="border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">Template Sync Queued</p>
                  <p className="text-sm text-muted-foreground">
                    Your sync request is in the queue and will be processed shortly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground mt-2">
              Manage your WhatsApp, Email, and SMS templates
            </p>
          </div>
          <div className="flex gap-2">
            {activeTab === "whatsapp" ? (
              <>
                <Button onClick={() => window.location.href = '/templates/create'} variant="default">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
                <Button onClick={handleSync} disabled={syncing} variant="outline">
                  {syncing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Templates
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={handleCreateEmail} variant="default">
                <Plus className="mr-2 h-4 w-4" />
                Create Email Template
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp ({whatsappTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email ({emailTemplates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="mt-6">
            {whatsappTemplates.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-12 w-12" />}
                title="No templates found"
                message="Create a WhatsApp template and submit it to Exotel for approval"
                action={
                  <Button onClick={() => window.location.href = '/templates/create'}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {whatsappTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{template.template_name}</CardTitle>
                        <Badge variant={getStatusColor(template.status)}>
                          {template.status}
                        </Badge>
                      </div>
                      <CardDescription>
                        {template.category} • {template.language}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 bg-muted rounded-md text-sm">
                        {template.content}
                      </div>
                      {template.variables && template.variables.length > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">Variables:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.variables.map((v: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {`{{${v.index}}}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Submission Status */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Exotel Status:</span>
                        <Badge variant={template.submission_status === 'synced' ? 'default' : 'secondary'}>
                          {getSubmissionStatusLabel(template)}
                        </Badge>
                      </div>
                      
                      {/* Rejection reason if any */}
                      {template.rejection_reason && (
                        <div className="p-2 bg-destructive/10 rounded text-xs text-destructive">
                          {template.rejection_reason}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {template.submitted_at 
                            ? `Submitted: ${format(new Date(template.submitted_at), "PPp")}`
                            : template.last_synced_at 
                              ? `Created: ${format(new Date(template.last_synced_at), "PPp")}`
                              : 'Not submitted yet'
                          }
                        </div>
                        
                        {canSubmitToExotel(template) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSubmitToExotel(template)}
                            disabled={submittingTemplateId === template.id}
                          >
                            {submittingTemplateId === template.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <Send className="mr-1 h-3 w-3" />
                                Submit
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="email" className="mt-6">
            {emailTemplates.length === 0 ? (
              <EmptyState
                icon={<Mail className="h-12 w-12" />}
                title="No email templates found"
                message="Create your first email template with our drag-and-drop editor"
                action={
                  <Button onClick={handleCreateEmail}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Email Template
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {emailTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="default">Email</Badge>
                      </div>
                      <CardDescription>{template.subject}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 bg-muted rounded-md text-sm max-h-32 overflow-hidden">
                        <div dangerouslySetInnerHTML={{ __html: (template as any).body_content || template.html_content }} />
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                        <span>Updated: {format(new Date(template.updated_at), "PPp")}</span>
                        {(template as any).buttons && (template as any).buttons.length > 0 && (
                          <span className="font-medium">
                            {(template as any).buttons.length} button{(template as any).buttons.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {(template as any).attachments && (template as any).attachments.length > 0 && (
                          <span className="font-medium">
                            {(template as any).attachments.length} attachment{(template as any).attachments.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditEmail(template)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteEmail(template.id)}
                          className="flex-1"
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <StandardEmailTemplateDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        template={selectedEmailTemplate}
        onSuccess={refetchEmailTemplates}
      />
    </DashboardLayout>
  );
};

export default Templates;
