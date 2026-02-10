import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicationId } = await req.json();
    if (!applicationId) {
      return new Response(JSON.stringify({ error: "applicationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch all documents for this application
    const { data: documents, error: docsError } = await supabase
      .from("loan_documents")
      .select("*")
      .eq("loan_application_id", applicationId);

    if (docsError) throw docsError;
    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: "No documents found for this application" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[FraudDetection] Found ${documents.length} documents for application ${applicationId}`);

    // 2. Download documents and prepare for analysis
    const docAnalysisResults: any[] = [];
    const ocrDataMap: Record<string, any> = {};

    for (const doc of documents) {
      if (!doc.file_path) continue;

      // Collect OCR data for cross-document checks
      if (doc.ocr_data && typeof doc.ocr_data === "object") {
        ocrDataMap[doc.document_type] = doc.ocr_data;
      }

      // Download document from storage
      const { data: fileData, error: dlError } = await supabase.storage
        .from("loan-documents")
        .download(doc.file_path);

      if (dlError || !fileData) {
        console.error(`[FraudDetection] Failed to download ${doc.document_type}:`, dlError);
        docAnalysisResults.push({
          document_type: doc.document_type,
          risk_level: "unknown",
          issues: ["Could not download document for analysis"],
        });
        continue;
      }

      // Convert to base64 (chunked to avoid stack overflow on large files)
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      const mimeType = doc.mime_type || "image/jpeg";

      // 3. Send to Gemini for fraud analysis
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a document fraud detection expert for Indian financial documents. Analyze the provided document image for signs of tampering, forgery, or manipulation. Look for:
1. Font inconsistencies - different fonts/sizes for key fields vs headers
2. Pixel artifacts - signs of digital editing, blur patches, misaligned elements
3. Color/lighting inconsistencies - different brightness/contrast in edited areas
4. Cut-paste artifacts - visible edges, mismatched backgrounds
5. Unrealistic values - salary amounts that seem fabricated, dates that don't make sense
6. Format anomalies - missing standard elements, unusual layouts for the document type
7. Watermark/logo issues - low resolution logos, missing expected watermarks

Respond ONLY with a valid JSON object (no markdown, no code blocks):
{
  "risk_level": "low" | "medium" | "high",
  "confidence": 0-100,
  "issues": ["list of specific issues found, empty if none"],
  "details": "brief explanation of findings"
}`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analyze this ${doc.document_type.replace(/_/g, " ")} document for signs of fraud or tampering.`,
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${base64}`,
                    },
                  },
                ],
              },
            ],
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            console.warn("[FraudDetection] Rate limited, skipping remaining documents");
            docAnalysisResults.push({
              document_type: doc.document_type,
              risk_level: "unknown",
              issues: ["Rate limited - try again later"],
            });
            break;
          }
          throw new Error(`AI gateway error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        // Parse AI response
        let parsed;
        try {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { risk_level: "low", issues: [], details: "Could not parse AI response" };
        } catch {
          parsed = { risk_level: "low", issues: [], details: "Could not parse AI response" };
        }

        docAnalysisResults.push({
          document_type: doc.document_type,
          risk_level: parsed.risk_level || "low",
          confidence: parsed.confidence || 0,
          issues: parsed.issues || [],
          details: parsed.details || "",
        });

        console.log(`[FraudDetection] ${doc.document_type}: ${parsed.risk_level} risk`);
      } catch (aiErr) {
        console.error(`[FraudDetection] AI analysis failed for ${doc.document_type}:`, aiErr);
        docAnalysisResults.push({
          document_type: doc.document_type,
          risk_level: "unknown",
          issues: ["AI analysis failed"],
        });
      }

      // Small delay between documents to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    }

    // 4. Cross-document consistency checks using OCR data
    const crossChecks: any[] = [];

    // Name consistency
    const names: Record<string, string> = {};
    for (const [docType, ocr] of Object.entries(ocrDataMap)) {
      const ocrObj = ocr as Record<string, any>;
      const name = ocrObj.name || ocrObj.full_name || ocrObj.employee_name || ocrObj.account_holder_name;
      if (name && typeof name === "string") {
        names[docType] = name.trim().toLowerCase();
      }
    }
    if (Object.keys(names).length >= 2) {
      const uniqueNames = [...new Set(Object.values(names))];
      crossChecks.push({
        check: "Name consistency",
        status: uniqueNames.length === 1 ? "pass" : uniqueNames.length <= 2 ? "warning" : "fail",
        detail:
          uniqueNames.length === 1
            ? `Name matches across ${Object.keys(names).length} documents`
            : `Different names found: ${Object.entries(names).map(([k, v]) => `${k}: "${v}"`).join(", ")}`,
      });
    }

    // PAN consistency
    const pans: Record<string, string> = {};
    for (const [docType, ocr] of Object.entries(ocrDataMap)) {
      const ocrObj = ocr as Record<string, any>;
      const pan = ocrObj.pan_number || ocrObj.pan;
      if (pan && typeof pan === "string" && pan.length === 10) {
        pans[docType] = pan.toUpperCase();
      }
    }
    if (Object.keys(pans).length >= 2) {
      const uniquePans = [...new Set(Object.values(pans))];
      crossChecks.push({
        check: "PAN number consistency",
        status: uniquePans.length === 1 ? "pass" : "fail",
        detail:
          uniquePans.length === 1
            ? "PAN number matches across documents"
            : `Mismatched PAN numbers: ${Object.entries(pans).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
      });
    }

    // DOB consistency
    const dobs: Record<string, string> = {};
    for (const [docType, ocr] of Object.entries(ocrDataMap)) {
      const ocrObj = ocr as Record<string, any>;
      const dob = ocrObj.date_of_birth || ocrObj.dob;
      if (dob && typeof dob === "string") {
        dobs[docType] = dob;
      }
    }
    if (Object.keys(dobs).length >= 2) {
      const uniqueDobs = [...new Set(Object.values(dobs))];
      crossChecks.push({
        check: "Date of birth consistency",
        status: uniqueDobs.length === 1 ? "pass" : "fail",
        detail:
          uniqueDobs.length === 1
            ? "DOB matches across documents"
            : `Different DOBs found: ${Object.entries(dobs).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
      });
    }

    // Salary consistency across salary slips
    const salaries: Record<string, number> = {};
    for (const [docType, ocr] of Object.entries(ocrDataMap)) {
      if (!docType.startsWith("salary_slip")) continue;
      const ocrObj = ocr as Record<string, any>;
      const salary = ocrObj.net_salary || ocrObj.net_pay || ocrObj.gross_salary;
      if (salary && typeof salary === "number") {
        salaries[docType] = salary;
      }
    }
    if (Object.keys(salaries).length >= 2) {
      const vals = Object.values(salaries);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const maxDev = Math.max(...vals.map((v) => Math.abs(v - avg) / avg));
      crossChecks.push({
        check: "Salary consistency across slips",
        status: maxDev < 0.1 ? "pass" : maxDev < 0.3 ? "warning" : "fail",
        detail:
          maxDev < 0.1
            ? "Salary amounts are consistent across slips"
            : `Salary variation of ${(maxDev * 100).toFixed(0)}% detected across slips`,
      });
    }

    // 5. Calculate overall risk
    const riskLevels = docAnalysisResults.map((r) => r.risk_level);
    const highCount = riskLevels.filter((r) => r === "high").length;
    const mediumCount = riskLevels.filter((r) => r === "medium").length;
    const failedChecks = crossChecks.filter((c) => c.status === "fail").length;

    let overallRisk = "low";
    let riskScore = 0;

    if (highCount > 0 || failedChecks >= 2) {
      overallRisk = "high";
      riskScore = Math.min(100, 60 + highCount * 15 + failedChecks * 10);
    } else if (mediumCount > 0 || failedChecks >= 1) {
      overallRisk = "medium";
      riskScore = Math.min(59, 30 + mediumCount * 10 + failedChecks * 10);
    } else {
      overallRisk = "low";
      riskScore = Math.max(0, mediumCount * 5);
    }

    const result = {
      overall_risk: overallRisk,
      risk_score: riskScore,
      documents_analyzed: docAnalysisResults.length,
      findings: docAnalysisResults,
      cross_document_checks: crossChecks,
      analyzed_at: new Date().toISOString(),
    };

    // 6. Store in loan_verifications
    const { error: upsertError } = await supabase
      .from("loan_verifications")
      .upsert(
        {
          loan_application_id: applicationId,
          verification_type: "document_fraud_check",
          status: overallRisk === "high" ? "failed" : overallRisk === "medium" ? "warning" : "success",
          verification_source: "ai_gemini",
          response_data: result,
          verified_at: new Date().toISOString(),
          remarks: `Fraud check: ${overallRisk} risk (score: ${riskScore}). ${docAnalysisResults.length} documents analyzed.`,
        },
        { onConflict: "loan_application_id,verification_type" }
      );

    if (upsertError) {
      console.error("[FraudDetection] Failed to save verification:", upsertError);
      // Try insert instead (if no unique constraint exists)
      await supabase.from("loan_verifications").insert({
        loan_application_id: applicationId,
        verification_type: "document_fraud_check",
        status: overallRisk === "high" ? "failed" : overallRisk === "medium" ? "warning" : "success",
        verification_source: "ai_gemini",
        response_data: result,
        verified_at: new Date().toISOString(),
        remarks: `Fraud check: ${overallRisk} risk (score: ${riskScore}). ${docAnalysisResults.length} documents analyzed.`,
      });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[FraudDetection] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
