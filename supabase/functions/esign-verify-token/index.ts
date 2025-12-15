import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();

    if (!token) {
      throw new Error("Token is required");
    }

    console.log("[esign-verify-token] Verifying token");

    // Get esign request by token
    const { data: esignRequest, error: fetchError } = await supabase
      .from("document_esign_requests")
      .select(`
        *,
        application:loan_applications(
          id,
          application_number,
          applicants,
          loan_amount,
          loan_type,
          tenure_months,
          interest_rate,
          processing_fee,
          status
        ),
        document:loan_generated_documents(
          id,
          document_type,
          generated_at
        ),
        organization:organizations(
          id,
          name
        )
      `)
      .eq("access_token", token)
      .single();

    if (fetchError || !esignRequest) {
      console.error("[esign-verify-token] Token not found:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired
    if (new Date(esignRequest.token_expires_at) < new Date()) {
      console.log("[esign-verify-token] Token expired");
      return new Response(
        JSON.stringify({ success: false, error: "This signing link has expired. Please request a new link." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already signed
    if (esignRequest.status === 'signed') {
      console.log("[esign-verify-token] Document already signed");
      return new Response(
        JSON.stringify({ 
          success: true, 
          alreadySigned: true,
          signedAt: esignRequest.signed_at,
          signedDocumentPath: esignRequest.signed_document_path
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP for audit
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    // Mark as viewed if first time
    if (esignRequest.status === 'pending') {
      const updatedAuditLog = [
        ...(esignRequest.audit_log || []),
        {
          action: 'viewed',
          timestamp: new Date().toISOString(),
          ip: clientIp
        }
      ];

      await supabase
        .from("document_esign_requests")
        .update({ 
          status: 'viewed',
          viewed_at: new Date().toISOString(),
          audit_log: updatedAuditLog
        })
        .eq("id", esignRequest.id);
    }

    // Get applicant details
    const applicants = esignRequest.application?.applicants || [];
    const primaryApplicant = applicants.find((a: any) => a.is_primary) || applicants[0];

    // Return document info for rendering
    const response = {
      success: true,
      requestId: esignRequest.id,
      status: esignRequest.status === 'pending' ? 'viewed' : esignRequest.status,
      documentType: esignRequest.document_type,
      signerName: esignRequest.signer_name,
      application: {
        id: esignRequest.application?.id,
        applicationNumber: esignRequest.application?.application_number,
        loanAmount: esignRequest.application?.loan_amount,
        loanType: esignRequest.application?.loan_type,
        tenureMonths: esignRequest.application?.tenure_months,
        interestRate: esignRequest.application?.interest_rate,
        processingFee: esignRequest.application?.processing_fee,
        applicantName: primaryApplicant ? `${primaryApplicant.first_name} ${primaryApplicant.last_name}` : esignRequest.signer_name,
        applicantAddress: primaryApplicant?.address ? 
          `${primaryApplicant.address.address_line1 || ''}, ${primaryApplicant.address.city || ''}, ${primaryApplicant.address.state || ''} - ${primaryApplicant.address.pincode || ''}` : null,
        applicants: applicants
      },
      organization: {
        name: esignRequest.organization?.name || "Lender"
      },
      expiresAt: esignRequest.token_expires_at
    };

    console.log("[esign-verify-token] Token verified successfully for request:", esignRequest.id);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[esign-verify-token] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
