import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface SendSanctionRequest {
  applicationId: string;
  sanctionId: string;
  customerEmail: string;
  customerName: string;
  sanctionLetterHtml: string;
  loanAgreementHtml: string;
  loanDetails: {
    applicationNumber: string;
    sanctionNumber: string;
    approvedAmount: number;
    tenure: number;
    interestRate: number;
    processingFee: number;
    netDisbursement: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== send-sanction-documents Request Started ===');
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error('No Authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error(`Authentication failed: ${authError?.message || 'No user found'}`);
    }

    console.log('✓ User authenticated:', user.email);

    const requestData: SendSanctionRequest = await req.json();
    const { 
      applicationId, 
      sanctionId, 
      customerEmail, 
      customerName, 
      sanctionLetterHtml, 
      loanAgreementHtml,
      loanDetails 
    } = requestData;

    // Fetch user profile and org_id
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("org_id, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.org_id) {
      throw new Error("User organization not found");
    }

    // Get email settings
    const { data: emailSettings, error: settingsError } = await supabaseClient
      .from("email_settings")
      .select("sending_domain, verification_status, is_active")
      .eq("org_id", profile.org_id)
      .maybeSingle();

    if (!emailSettings || !emailSettings.is_active) {
      throw new Error("Email sending is not configured. Please set up your sending domain in Email Settings.");
    }

    if (emailSettings.verification_status !== "verified") {
      throw new Error("Email domain verification pending. Please verify your domain first.");
    }

    const fromEmail = `loans@${emailSettings.sending_domain}`;
    const fromName = profile.first_name 
      ? `${profile.first_name} ${profile.last_name || ''}`.trim()
      : "Loan Department";

    // Create email HTML with document links
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
          .loan-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .loan-details table { width: 100%; border-collapse: collapse; }
          .loan-details td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .loan-details td:first-child { font-weight: bold; color: #64748b; }
          .loan-details td:last-child { text-align: right; color: #1a365d; font-weight: bold; }
          .documents { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
          .amount { color: #059669; font-size: 24px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Loan Sanctioned</h1>
            <p>Congratulations on your loan approval!</p>
          </div>
          <div class="content">
            <p>Dear <strong>${customerName}</strong>,</p>
            <p>We are pleased to inform you that your loan application has been sanctioned. Please find the details below:</p>
            
            <div class="loan-details">
              <table>
                <tr>
                  <td>Application Number</td>
                  <td>${loanDetails.applicationNumber}</td>
                </tr>
                <tr>
                  <td>Sanction Number</td>
                  <td>${loanDetails.sanctionNumber}</td>
                </tr>
                <tr>
                  <td>Sanctioned Amount</td>
                  <td class="amount">₹${loanDetails.approvedAmount.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td>Tenure</td>
                  <td>${loanDetails.tenure} days</td>
                </tr>
                <tr>
                  <td>Interest Rate</td>
                  <td>${loanDetails.interestRate}% per day</td>
                </tr>
                <tr>
                  <td>Processing Fee</td>
                  <td>₹${loanDetails.processingFee.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td>Net Disbursement</td>
                  <td>₹${loanDetails.netDisbursement.toLocaleString('en-IN')}</td>
                </tr>
              </table>
            </div>

            <div class="documents">
              <h3>📄 Important Documents Attached</h3>
              <ul>
                <li><strong>Sanction Letter</strong> - Official loan sanction document</li>
                <li><strong>Loan Agreement</strong> - Terms and conditions of the loan</li>
              </ul>
              <p><em>Please review, sign, and return the documents to proceed with disbursement.</em></p>
            </div>

            <p>If you have any questions, please contact our loan department.</p>
            <p>Thank you for choosing us!</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via Resend with attachments
    console.log('Sending sanction documents email to:', customerEmail);
    
    const emailPayload: any = {
      from: `${fromName} <${fromEmail}>`,
      to: [customerEmail],
      subject: `Loan Sanctioned - ${loanDetails.applicationNumber} | Amount: ₹${loanDetails.approvedAmount.toLocaleString('en-IN')}`,
      html: emailHtml,
      attachments: [
        {
          filename: `Sanction_Letter_${loanDetails.sanctionNumber}.html`,
          content: btoa(unescape(encodeURIComponent(sanctionLetterHtml))),
        },
        {
          filename: `Loan_Agreement_${loanDetails.sanctionNumber}.html`,
          content: btoa(unescape(encodeURIComponent(loanAgreementHtml))),
        }
      ]
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend API error:', error);
      throw new Error(error.message || "Failed to send email");
    }

    const emailData = await response.json();
    console.log("Email sent successfully:", emailData);

    // Update sanction record with email timestamp
    const { error: updateError } = await supabaseClient
      .from("loan_sanctions")
      .update({
        documents_emailed_at: new Date().toISOString(),
        customer_email: customerEmail,
        status: 'emailed'
      })
      .eq("id", sanctionId);

    if (updateError) {
      console.error('Failed to update sanction record:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailData?.id,
        message: 'Sanction documents sent successfully'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('=== send-sanction-documents Error ===');
    console.error('Error:', error.message);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message.includes('Authentication') ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
