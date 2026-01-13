import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ORGANIZATION_ID } from "@/config/organization";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotification } from "@/hooks/useNotification";
import { LoadingState } from "@/components/common/LoadingState";
import { Loader2, MessageSquare, CheckCircle2 } from "lucide-react";

interface WhatsAppSettings {
  id?: string;
  exotel_sid: string;
  exotel_api_key: string;
  exotel_api_token: string;
  exotel_subdomain: string;
  whatsapp_source_number: string;
  is_active: boolean;
}

const WhatsAppSettings = () => {
  const notify = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WhatsAppSettings>({
    exotel_sid: "",
    exotel_api_key: "",
    exotel_api_token: "",
    exotel_subdomain: "api.exotel.com",
    whatsapp_source_number: "",
    is_active: true,
  });
  const [templateCount, setTemplateCount] = useState(0);

  useEffect(() => {
    fetchSettings();
    fetchTemplateCount();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .eq("org_id", ORGANIZATION_ID)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          exotel_sid: data.exotel_sid || "",
          exotel_api_key: data.exotel_api_key || "",
          exotel_api_token: data.exotel_api_token || "",
          exotel_subdomain: data.exotel_subdomain || "api.exotel.com",
          whatsapp_source_number: data.whatsapp_source_number || "",
          is_active: data.is_active,
        });
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      notify.error("Error", "Failed to load WhatsApp settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateCount = async () => {
    try {
      const { count } = await supabase
        .from("communication_templates")
        .select("*", { count: "exact", head: true })
        .eq("org_id", ORGANIZATION_ID)
        .eq("template_type", "whatsapp");

      setTemplateCount(count || 0);
    } catch (error) {
      console.error("Error fetching template count:", error);
    }
  };

  const handleSave = async () => {
    console.log("[WhatsAppSettings] ========== SAVE STARTED ==========");
    console.log("[WhatsAppSettings] handleSave called at:", new Date().toISOString());
    console.log("[WhatsAppSettings] Current settings:", JSON.stringify(settings, null, 2));
    console.log("[WhatsAppSettings] ORGANIZATION_ID:", ORGANIZATION_ID);
    
    if (!settings.exotel_sid || !settings.exotel_api_key || !settings.exotel_api_token || !settings.whatsapp_source_number) {
      console.log("[WhatsAppSettings] Validation failed - missing required fields");
      notify.error("Validation Error", "Please fill in all required fields");
      return;
    }

    console.log("[WhatsAppSettings] Validation passed, starting save...");
    setSaving(true);
    
    try {
      const dataToSave = {
        ...(settings.id && { id: settings.id }),
        org_id: ORGANIZATION_ID,
        exotel_sid: settings.exotel_sid,
        exotel_api_key: settings.exotel_api_key,
        exotel_api_token: settings.exotel_api_token,
        exotel_subdomain: settings.exotel_subdomain,
        whatsapp_source_number: settings.whatsapp_source_number,
        is_active: settings.is_active,
      };

      console.log("[WhatsAppSettings] Step 1: Data prepared:", JSON.stringify(dataToSave, null, 2));
      
      console.log("[WhatsAppSettings] Step 2: Creating query...");
      const startTime = Date.now();
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout after 30s")), 30000);
      });
      
      // Create the actual upsert call
      const upsertCall = supabase
        .from("whatsapp_settings")
        .upsert(dataToSave, { onConflict: 'org_id' })
        .select();
      
      console.log("[WhatsAppSettings] Step 3: Executing with timeout...");
      
      // Race between upsert and timeout
      const result = await Promise.race([upsertCall, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      console.log("[WhatsAppSettings] Step 4: Response received in", duration, "ms");
      console.log("[WhatsAppSettings] Response:", result);

      const { data, error } = result as { data: any; error: any };

      console.log("[WhatsAppSettings] Response data:", data);
      console.log("[WhatsAppSettings] Response error:", error);

      if (error) {
        console.error("[WhatsAppSettings] Upsert error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      console.log("[WhatsAppSettings] Step 5: Save successful!");
      notify.success("Success", "WhatsApp settings saved successfully");
      fetchSettings();
    } catch (error: any) {
      console.error("[WhatsAppSettings] CATCH BLOCK ERROR:", error);
      console.error("[WhatsAppSettings] Error type:", typeof error);
      console.error("[WhatsAppSettings] Error name:", error?.name);
      console.error("[WhatsAppSettings] Error message:", error?.message);
      console.error("[WhatsAppSettings] Error code:", error?.code);
      console.error("[WhatsAppSettings] Error details:", error?.details);
      console.error("[WhatsAppSettings] Error hint:", error?.hint);
      console.error("[WhatsAppSettings] Error stack:", error?.stack);
      notify.error("Error", error.message || "Failed to save settings");
    } finally {
      console.log("[WhatsAppSettings] FINALLY block executing - setting saving to false");
      setSaving(false);
      console.log("[WhatsAppSettings] ========== SAVE ENDED ==========");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading WhatsApp settings..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Configure your Exotel WhatsApp Business API credentials and webhook
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Exotel API Credentials
              </CardTitle>
              <CardDescription>
                Enter your Exotel API credentials to enable WhatsApp messaging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exotel-sid">Exotel SID *</Label>
                <Input
                  id="exotel-sid"
                  type="text"
                  placeholder="Enter your Exotel SID"
                  value={settings.exotel_sid}
                  onChange={(e) =>
                    setSettings({ ...settings, exotel_sid: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">Exotel API Key *</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Exotel API key"
                  value={settings.exotel_api_key}
                  onChange={(e) =>
                    setSettings({ ...settings, exotel_api_key: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-token">Exotel API Token *</Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Enter your Exotel API token"
                  value={settings.exotel_api_token}
                  onChange={(e) =>
                    setSettings({ ...settings, exotel_api_token: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Exotel Subdomain</Label>
                <Input
                  id="subdomain"
                  type="text"
                  placeholder="api.exotel.com"
                  value={settings.exotel_subdomain}
                  onChange={(e) =>
                    setSettings({ ...settings, exotel_subdomain: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Default: api.exotel.com (change if using a different region)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source-number">WhatsApp Source Number *</Label>
                <Input
                  id="source-number"
                  type="text"
                  placeholder="+917738919680"
                  value={settings.whatsapp_source_number}
                  onChange={(e) =>
                    setSettings({ ...settings, whatsapp_source_number: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Enter the phone number with + and country code
                </p>
              </div>

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={`https://xopuasvbypkiszcqgdwm.supabase.co/functions/v1/whatsapp-webhook`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://xopuasvbypkiszcqgdwm.supabase.co/functions/v1/whatsapp-webhook`);
                      notify.success("Copied!", "Webhook URL copied to clipboard");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure this URL in your Exotel dashboard to receive message status updates
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is-active">Enable WhatsApp</Label>
                <Switch
                  id="is-active"
                  checked={settings.is_active}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, is_active: checked })
                  }
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Templates
              </CardTitle>
              <CardDescription>
                Manage your WhatsApp message templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Local Templates
                </div>
                <div className="text-3xl font-bold">{templateCount}</div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => navigate("/templates")}
                  variant="secondary"
                  className="w-full"
                >
                  View All Templates
                </Button>

                <Button
                  onClick={() => navigate("/templates/create")}
                  variant="outline"
                  className="w-full"
                >
                  Create New Template
                </Button>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Quick Guide:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create templates in the Templates section</li>
                  <li>Use variables like {"{{1}}"}, {"{{2}}"} for personalization</li>
                  <li>Send messages to contacts via WhatsApp</li>
                  <li>Track delivery status in message history</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppSettings;
