import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NupayWebhookPayload {
  id: string;                    // Nupay mandate ID
  accptd?: string;               // "accepted" | "rejected"
  accpt_ref_no?: string;
  reason_code?: string;          // "000" for success, "AP30", "AP46" etc.
  reason_desc?: string;
  reject_by?: string;            // "N/A", "NPCI", "BANK"
  npci_ref?: string;
  credit_datetime?: string;
  umrn?: string;                 // UMRN on success
  auth_type?: string;
  reference_id?: string;
  loan_no?: string;
  // Alternative field names (Nupay may use different casing)
  Id?: string;
  Accptd?: string;
  ReasonCode?: string;
  ReasonDesc?: string;
  RejectBy?: string;
  NpciRef?: string;
  Umrn?: string;
  AuthType?: string;
  ReferenceId?: string;
  LoanNo?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log("[Nupay-Webhook] Received webhook request");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    let payload: NupayWebhookPayload;
    
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      payload = Object.fromEntries(formData) as unknown as NupayWebhookPayload;
    } else {
      // Try JSON first, then form data
      try {
        payload = await req.json();
      } catch {
        const text = await req.text();
        const params = new URLSearchParams(text);
        payload = Object.fromEntries(params) as unknown as NupayWebhookPayload;
      }
    }

    console.log("[Nupay-Webhook] Payload:", JSON.stringify(payload));

    // Normalize field names (handle different casing)
    const nupayId = payload.id || payload.Id;
    const accptd = payload.accptd || payload.Accptd;
    const reasonCode = payload.reason_code || payload.ReasonCode;
    const reasonDesc = payload.reason_desc || payload.ReasonDesc;
    const rejectBy = payload.reject_by || payload.RejectBy;
    const npciRef = payload.npci_ref || payload.NpciRef;
    const umrn = payload.umrn || payload.Umrn;
    const loanNo = payload.loan_no || payload.LoanNo;

    if (!nupayId) {
      console.error("[Nupay-Webhook] Missing mandate ID in payload");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Missing mandate ID" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find mandate by nupay_id
    const { data: mandate, error: findError } = await supabase
      .from("nupay_mandates")
      .select("*")
      .eq("nupay_id", nupayId)
      .single();

    if (findError || !mandate) {
      // Try finding by loan_no if nupay_id not found
      if (loanNo) {
        const { data: mandateByLoan, error: findByLoanError } = await supabase
          .from("nupay_mandates")
          .select("*")
          .eq("loan_no", loanNo)
          .single();

        if (!findByLoanError && mandateByLoan) {
          console.log("[Nupay-Webhook] Found mandate by loan_no:", mandateByLoan.id);
        } else {
          console.error("[Nupay-Webhook] Mandate not found for nupay_id:", nupayId);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "Mandate not found",
              client_reference_no: nupayId 
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.error("[Nupay-Webhook] Mandate not found for nupay_id:", nupayId);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Mandate not found",
            client_reference_no: nupayId 
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Map Nupay status to our status
    let newStatus = mandate?.status || "pending";
    
    if (accptd === "accepted" || accptd === "Accepted" || reasonCode === "000") {
      newStatus = "accepted";
    } else if (accptd === "rejected" || accptd === "Rejected") {
      newStatus = "rejected";
    }

    // Update mandate record
    const updateData: Record<string, any> = {
      status: newStatus,
      webhook_payload: payload,
      updated_at: new Date().toISOString(),
    };

    if (umrn) updateData.umrn = umrn;
    if (npciRef) updateData.npci_ref = npciRef;
    if (reasonCode) updateData.rejection_reason_code = reasonCode;
    if (reasonDesc) updateData.rejection_reason_desc = reasonDesc;
    if (rejectBy) updateData.rejected_by = rejectBy;

    const { error: updateError } = await supabase
      .from("nupay_mandates")
      .update(updateData)
      .eq("nupay_id", nupayId);

    if (updateError) {
      console.error("[Nupay-Webhook] Failed to update mandate:", updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to update mandate",
          client_reference_no: nupayId 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Nupay-Webhook] Mandate ${nupayId} updated to status: ${newStatus}`);

    // Return success response in Nupay expected format
    return new Response(
      JSON.stringify({ 
        success: true, 
        client_reference_no: mandate?.loan_no || nupayId,
        message: `Mandate ${newStatus === "accepted" ? "approved" : newStatus} successfully processed` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Nupay-Webhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
