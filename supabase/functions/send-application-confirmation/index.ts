import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationRequest {
  org_id: string;
  applicant_name: string;
  applicant_phone: string;
  application_number: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ConfirmationRequest = await req.json();
    const { org_id, applicant_name, applicant_phone, application_number } = body;

    console.log(`[App Confirmation] ========== SENDING CONFIRMATION ==========`);
    console.log(`[App Confirmation] Org: ${org_id}`);
    console.log(`[App Confirmation] Applicant: ${applicant_name}, Phone: ${applicant_phone}`);
    console.log(`[App Confirmation] Application Number: ${application_number}`);

    if (!org_id || !applicant_name || !applicant_phone || !application_number) {
      console.log("[App Confirmation] Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp settings for the org
    const { data: whatsappSettings, error: settingsError } = await supabase
      .from("whatsapp_settings")
      .select("exotel_sid, exotel_api_key, exotel_api_token, exotel_subdomain, whatsapp_source_number")
      .eq("org_id", org_id)
      .single();

    if (settingsError || !whatsappSettings?.exotel_sid) {
      console.log("[App Confirmation] WhatsApp settings not configured for org:", org_id);
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp settings not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { exotel_sid, exotel_api_key, exotel_api_token, exotel_subdomain, whatsapp_source_number } = whatsappSettings;

    // Format phone number for Exotel API (digits only, with 91 prefix)
    let formattedPhone = applicant_phone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = `91${formattedPhone}`;
    }
    if (!formattedPhone.startsWith("91")) {
      formattedPhone = `91${formattedPhone}`;
    }

    // Format phone for database storage (with + prefix)
    const storagePhone = `+${formattedPhone}`;

    const subdomain = exotel_subdomain || "api.exotel.com";
    const exotelUrl = `https://${subdomain}/v2/accounts/${exotel_sid}/messages`;
    const authHeader = `Basic ${btoa(`${exotel_api_key}:${exotel_api_token}`)}`;

    // Build the app_confirmation template payload
    // Template: "Dear {{1}} Thanks for your application Your application ID is {{2}}. Our team will get in touch with you soon."
    const payload = {
      whatsapp: {
        messages: [{
          from: whatsapp_source_number,
          to: formattedPhone,
          content: {
            type: "template",
            template: {
              name: "app_confirmation",
              language: {
                code: "en"
              },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: applicant_name },      // {{1}} - Applicant Name
                    { type: "text", text: application_number }   // {{2}} - Application Number
                  ]
                }
              ]
            }
          }
        }]
      }
    };

    console.log("[App Confirmation] Sending WhatsApp to:", formattedPhone);
    console.log("[App Confirmation] Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch(exotelUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log("[App Confirmation] Response status:", response.status);
    console.log("[App Confirmation] Response:", responseText);

    if (!response.ok) {
      console.error("[App Confirmation] Failed to send WhatsApp:", responseText);
      return new Response(
        JSON.stringify({ success: false, error: `WhatsApp API error: ${response.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse response to get message ID
    let exotelMessageId: string | null = null;
    try {
      // Handle potential non-JSON prefix in response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const responseData = JSON.parse(jsonMatch[0]);
        exotelMessageId = responseData?.whatsapp?.messages?.[0]?.id || 
                          responseData?.data?.whatsapp?.messages?.[0]?.id || 
                          null;
      }
    } catch (parseError) {
      console.log("[App Confirmation] Could not parse message ID from response");
    }

    // Log message in whatsapp_messages table for chat history
    const templateContent = `Dear ${applicant_name} Thanks for your application Your application ID is ${application_number}. Our team will get in touch with you soon.`;
    
    const { error: logError } = await supabase
      .from("whatsapp_messages")
      .insert({
        org_id: org_id,
        from_number: whatsapp_source_number,
        to_number: storagePhone,
        direction: "outbound",
        message_type: "template",
        content: templateContent,
        template_name: "app_confirmation",
        status: "sent",
        exotel_message_id: exotelMessageId,
      });

    if (logError) {
      console.error("[App Confirmation] Failed to log message:", logError);
    } else {
      console.log("[App Confirmation] Message logged successfully");
    }

    console.log(`[App Confirmation] ========== CONFIRMATION SENT ==========`);

    return new Response(
      JSON.stringify({ success: true, message: "Application confirmation sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[App Confirmation] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
