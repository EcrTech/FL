import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface NotificationRequest {
  org_id: string;
  signer_name: string;
  signer_email?: string;
  signer_mobile: string;
  registration_url: string;
  loan_no?: string;
  collection_amount?: number;
  channels: ("whatsapp" | "email")[];
}

// Send Email via Resend
async function sendEmailNotification(
  to: string,
  signerName: string,
  registrationUrl: string,
  loanNo: string | undefined,
  collectionAmount: number | undefined,
  emailSettings: { sending_domain: string; from_name?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const fromEmail = `info@${emailSettings.sending_domain}`;
  const fromName = emailSettings.from_name || "Paisaa Saarthi eMandate";

  const amountDisplay = collectionAmount 
    ? `₹${collectionAmount.toLocaleString("en-IN")}` 
    : "as per agreement";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your eMandate Registration</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">✅ eMandate Registration</h1>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Dear <strong>${signerName}</strong>,</p>
    
    <p style="font-size: 16px;">Please complete your eMandate registration to enable automatic EMI deductions from your bank account.</p>
    
    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
      ${loanNo ? `<p style="font-size: 14px; color: #166534; margin: 0 0 8px 0;"><strong>Loan Reference:</strong> ${loanNo}</p>` : ""}
      <p style="font-size: 14px; color: #166534; margin: 0;"><strong>EMI Amount:</strong> ${amountDisplay}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${registrationUrl}" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">Complete Registration</a>
    </div>
    
    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fde68a;">
      <p style="font-size: 14px; color: #92400e; margin: 0;"><strong>Authentication Required:</strong> You will need to authenticate via Net Banking, Debit Card OTP, or Aadhaar OTP to complete the registration.</p>
    </div>
    
    <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link in your browser:</p>
    <p style="font-size: 12px; word-break: break-all; color: #16a34a;">${registrationUrl}</p>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      This link is valid for a limited time. Please complete the registration at your earliest convenience.
    </p>
  </div>
</body>
</html>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: "Complete Your eMandate Registration",
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[eMandate Notify] Email send failed:", error);
      return { success: false, error: error.message || "Failed to send email" };
    }

    const result = await response.json();
    console.log("[eMandate Notify] Email sent successfully:", result.id);
    return { success: true };
  } catch (error) {
    console.error("[eMandate Notify] Email error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Email send error" };
  }
}

// Send WhatsApp via Exotel
async function sendWhatsAppNotification(
  phoneNumber: string,
  signerName: string,
  registrationUrl: string,
  whatsappSettings: {
    exotel_sid: string;
    exotel_api_key: string;
    exotel_api_token: string;
    exotel_subdomain: string;
    whatsapp_source_number: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { exotel_sid, exotel_api_key, exotel_api_token, exotel_subdomain, whatsapp_source_number } = whatsappSettings;

  if (!exotel_sid || !exotel_api_key || !exotel_api_token) {
    return { success: false, error: "Exotel credentials not configured" };
  }

  // Format phone number (ensure +91 prefix for India)
  let formattedPhone = phoneNumber.replace(/\D/g, "");
  if (formattedPhone.length === 10) {
    formattedPhone = `91${formattedPhone}`;
  }
  if (!formattedPhone.startsWith("91")) {
    formattedPhone = `91${formattedPhone}`;
  }

  const subdomain = exotel_subdomain || "api.exotel.com";
  const exotelUrl = `https://${subdomain}/v2/accounts/${exotel_sid}/messages`;
  const authHeader = `Basic ${btoa(`${exotel_api_key}:${exotel_api_token}`)}`;

  // Use the approved 2-variable emandate_request template (UTILITY category):
  // {{1}} = Customer Name, {{2}} = Registration URL
  // Exotel requires 'whatsapp: { messages: [...] }' wrapper format
  const payload = {
    whatsapp: {
      messages: [{
        from: whatsapp_source_number,
        to: formattedPhone,
        content: {
          type: "template",
          template: {
            name: "emandate_request",
            language: {
              code: "en"
            },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: signerName },
                  { type: "text", text: registrationUrl }
                ]
              }
            ]
          }
        }
      }]
    }
  };

  console.log("[eMandate Notify] Sending WhatsApp to:", formattedPhone);
  console.log("[eMandate Notify] WhatsApp payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(exotelUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log("[eMandate Notify] WhatsApp response status:", response.status);
    console.log("[eMandate Notify] WhatsApp response:", responseText);

    if (!response.ok) {
      return { success: false, error: `WhatsApp API error: ${response.status} - ${responseText}` };
    }

    console.log("[eMandate Notify] WhatsApp sent successfully");
    return { success: true };
  } catch (error) {
    console.error("[eMandate Notify] WhatsApp error:", error);
    return { success: false, error: error instanceof Error ? error.message : "WhatsApp send error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationRequest = await req.json();
    const {
      org_id,
      signer_name,
      signer_email,
      signer_mobile,
      registration_url,
      loan_no,
      collection_amount,
      channels,
    } = body;

    console.log(`[eMandate Notify] ========== NOTIFICATION REQUEST ==========`);
    console.log(`[eMandate Notify] Org: ${org_id}`);
    console.log(`[eMandate Notify] Customer: ${signer_name}, Mobile: ${signer_mobile}, Email: ${signer_email || "N/A"}`);
    console.log(`[eMandate Notify] Loan: ${loan_no || "N/A"}, Amount: ${collection_amount || "N/A"}`);
    console.log(`[eMandate Notify] Channels: ${channels.join(", ")}`);

    const results: { channel: string; success: boolean; error?: string }[] = [];

    // Send Email notification
    if (channels.includes("email") && signer_email) {
      console.log("[eMandate Notify] Sending email notification...");
      
      // Get email settings
      const { data: emailSettings } = await supabase
        .from("email_settings")
        .select("sending_domain, from_name")
        .eq("org_id", org_id)
        .eq("is_active", true)
        .single();

      // Use org's verified domain if available, otherwise use global verified domain
      const effectiveEmailSettings = emailSettings?.sending_domain 
        ? emailSettings 
        : { sending_domain: "paisaasaarthi.com", from_name: "Paisaa Saarthi eMandate" };

      const emailResult = await sendEmailNotification(
        signer_email,
        signer_name,
        registration_url,
        loan_no,
        collection_amount,
        effectiveEmailSettings
      );
      results.push({ channel: "email", ...emailResult });
    }

    // Send WhatsApp notification
    if (channels.includes("whatsapp") && signer_mobile) {
      console.log("[eMandate Notify] Sending WhatsApp notification...");
      
      // Get WhatsApp settings
      const { data: whatsappSettings } = await supabase
        .from("whatsapp_settings")
        .select("exotel_sid, exotel_api_key, exotel_api_token, exotel_subdomain, whatsapp_source_number")
        .eq("org_id", org_id)
        .single();

      if (whatsappSettings?.exotel_sid) {
        const whatsappResult = await sendWhatsAppNotification(
          signer_mobile,
          signer_name,
          registration_url,
          whatsappSettings
        );
        results.push({ channel: "whatsapp", ...whatsappResult });
      } else {
        results.push({ channel: "whatsapp", success: false, error: "WhatsApp settings not configured" });
      }
    }

    console.log("[eMandate Notify] Results:", JSON.stringify(results, null, 2));
    console.log(`[eMandate Notify] ========== NOTIFICATION COMPLETE ==========`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[eMandate Notify] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
