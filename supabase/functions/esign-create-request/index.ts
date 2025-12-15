import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateESignRequest {
  applicationId: string;
  documentId?: string;
  documentType: string;
  signerName: string;
  signerPhone?: string;
  signerEmail?: string;
  notificationChannel: 'sms' | 'email' | 'both';
  orgId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const body: CreateESignRequest = await req.json();
    const { applicationId, documentId, documentType, signerName, signerPhone, signerEmail, notificationChannel, orgId } = body;

    console.log("[esign-create-request] Creating request for:", { applicationId, documentType, signerName });

    // Generate secure access token (UUID + random suffix)
    const accessToken = crypto.randomUUID() + '-' + crypto.randomUUID().substring(0, 8);
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create esign request
    const { data: esignRequest, error: createError } = await supabase
      .from("document_esign_requests")
      .insert({
        org_id: orgId,
        application_id: applicationId,
        document_id: documentId,
        document_type: documentType,
        signer_name: signerName,
        signer_phone: signerPhone,
        signer_email: signerEmail,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        notification_channel: notificationChannel,
        created_by: user.id,
        audit_log: [{
          action: 'created',
          timestamp: new Date().toISOString(),
          by: user.id
        }]
      })
      .select()
      .single();

    if (createError) {
      console.error("[esign-create-request] Error creating request:", createError);
      throw new Error(`Failed to create eSign request: ${createError.message}`);
    }

    // Get application details for notifications
    const { data: application } = await supabase
      .from("loan_applications")
      .select("application_number, applicants")
      .eq("id", applicationId)
      .single();

    // Generate signing URL
    const appUrl = Deno.env.get("APP_URL") || "https://ashy-island-0287ec81e.4.azurestaticapps.net";
    const esignUrl = `${appUrl}/esign/${accessToken}`;

    // Get org details
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    const orgName = org?.name || "Your Lender";
    const applicationNumber = application?.application_number || applicationId.substring(0, 8);

    // Send notifications
    const notificationsSent: string[] = [];

    if ((notificationChannel === 'sms' || notificationChannel === 'both') && signerPhone) {
      // Send SMS via WhatsApp
      const smsMessage = `Dear ${signerName}, your loan documents are ready for signature. Please click to review and sign: ${esignUrl} - Valid for 24 hours. - ${orgName}`;
      
      try {
        const { error: smsError } = await supabase.functions.invoke("send-whatsapp-message", {
          body: {
            phone: signerPhone,
            message: smsMessage,
            orgId: orgId
          }
        });
        
        if (!smsError) {
          notificationsSent.push('sms');
          console.log("[esign-create-request] SMS sent successfully");
        } else {
          console.error("[esign-create-request] SMS error:", smsError);
        }
      } catch (e) {
        console.error("[esign-create-request] Failed to send SMS:", e);
      }
    }

    if ((notificationChannel === 'email' || notificationChannel === 'both') && signerEmail) {
      try {
        const { error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            to: signerEmail,
            subject: `Action Required: Sign Your Loan Documents - ${applicationNumber}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a365d;">Document Signing Required</h2>
                <p>Dear ${signerName},</p>
                <p>Your loan documents for application <strong>${applicationNumber}</strong> are ready for your signature.</p>
                <p><strong>Document:</strong> ${documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                <p style="margin: 30px 0;">
                  <a href="${esignUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Review & Sign Document
                  </a>
                </p>
                <p style="color: #666; font-size: 14px;">This link is valid for 24 hours. After clicking, you will be able to review the document and sign using Aadhaar OTP verification.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">${orgName}</p>
              </div>
            `,
            orgId: orgId
          }
        });
        
        if (!emailError) {
          notificationsSent.push('email');
          console.log("[esign-create-request] Email sent successfully");
        } else {
          console.error("[esign-create-request] Email error:", emailError);
        }
      } catch (e) {
        console.error("[esign-create-request] Failed to send email:", e);
      }
    }

    // Update notification sent timestamp
    if (notificationsSent.length > 0) {
      await supabase
        .from("document_esign_requests")
        .update({ 
          notification_sent_at: new Date().toISOString(),
          audit_log: [
            ...(esignRequest.audit_log || []),
            {
              action: 'notification_sent',
              channels: notificationsSent,
              timestamp: new Date().toISOString()
            }
          ]
        })
        .eq("id", esignRequest.id);
    }

    console.log("[esign-create-request] Request created successfully:", esignRequest.id);

    return new Response(
      JSON.stringify({
        success: true,
        requestId: esignRequest.id,
        esignUrl,
        notificationsSent,
        expiresAt: tokenExpiresAt.toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[esign-create-request] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
