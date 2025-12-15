import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOCUMENT_PROMPTS: Record<string, string> = {
  pan_card: `Extract the following from this PAN card image:
- pan_number: The PAN number (10 character alphanumeric)
- name: Full name as shown on card
- father_name: Father's name
- dob: Date of birth in YYYY-MM-DD format
Return ONLY valid JSON with these fields.`,

  aadhaar_card: `Extract the following from this Aadhaar card image:
- aadhaar_number: The 12-digit Aadhaar number (with or without spaces)
- name: Full name as shown
- dob: Date of birth in YYYY-MM-DD format
- gender: Male/Female
- address: Full address as shown
Return ONLY valid JSON with these fields.`,

  salary_slip_1: `Extract the following from this salary slip:
- employee_name: Employee full name
- employee_id: Employee ID if visible
- employer_name: Company/employer name
- month: Month and year (e.g., "January 2024")
- gross_salary: Total gross salary (number only)
- basic_salary: Basic salary component (number only)
- hra: HRA component (number only)
- other_allowances: Sum of other allowances (number only)
- pf_deduction: PF deduction (number only)
- professional_tax: Professional tax (number only)
- tds: TDS deducted (number only)
- other_deductions: Sum of other deductions (number only)
- net_salary: Net/take-home salary (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  salary_slip_2: `Extract the following from this salary slip:
- employee_name: Employee full name
- employee_id: Employee ID if visible
- employer_name: Company/employer name
- month: Month and year (e.g., "January 2024")
- gross_salary: Total gross salary (number only)
- basic_salary: Basic salary component (number only)
- hra: HRA component (number only)
- other_allowances: Sum of other allowances (number only)
- pf_deduction: PF deduction (number only)
- professional_tax: Professional tax (number only)
- tds: TDS deducted (number only)
- other_deductions: Sum of other deductions (number only)
- net_salary: Net/take-home salary (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  salary_slip_3: `Extract the following from this salary slip:
- employee_name: Employee full name
- employee_id: Employee ID if visible
- employer_name: Company/employer name
- month: Month and year (e.g., "January 2024")
- gross_salary: Total gross salary (number only)
- basic_salary: Basic salary component (number only)
- hra: HRA component (number only)
- other_allowances: Sum of other allowances (number only)
- pf_deduction: PF deduction (number only)
- professional_tax: Professional tax (number only)
- tds: TDS deducted (number only)
- other_deductions: Sum of other deductions (number only)
- net_salary: Net/take-home salary (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  form_16_year_1: `Extract the following from this Form 16:
- employee_name: Employee full name
- pan: PAN number
- employer_name: Employer/company name
- employer_tan: Employer TAN number
- assessment_year: Assessment year (e.g., "2023-24")
- financial_year: Financial year (e.g., "2022-23")
- gross_salary: Gross total income (number only)
- total_deductions: Total deductions under Chapter VI-A (number only)
- taxable_income: Net taxable income (number only)
- tax_deducted: Total TDS deducted (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  form_16_year_2: `Extract the following from this Form 16:
- employee_name: Employee full name
- pan: PAN number
- employer_name: Employer/company name
- employer_tan: Employer TAN number
- assessment_year: Assessment year (e.g., "2022-23")
- financial_year: Financial year (e.g., "2021-22")
- gross_salary: Gross total income (number only)
- total_deductions: Total deductions under Chapter VI-A (number only)
- taxable_income: Net taxable income (number only)
- tax_deducted: Total TDS deducted (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  itr_year_1: `Extract the following from this ITR acknowledgment/document:
- name: Assessee full name
- pan: PAN number
- assessment_year: Assessment year (e.g., "2023-24")
- itr_form_type: ITR form number (ITR-1, ITR-2, etc.)
- gross_total_income: Gross total income (number only)
- total_deductions: Total deductions claimed (number only)
- taxable_income: Total taxable income (number only)
- tax_payable: Total tax payable (number only)
- tax_paid: Tax already paid/TDS (number only)
- refund_due: Refund due if any (number only, 0 if not applicable)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  itr_year_2: `Extract the following from this ITR acknowledgment/document:
- name: Assessee full name
- pan: PAN number
- assessment_year: Assessment year (e.g., "2022-23")
- itr_form_type: ITR form number (ITR-1, ITR-2, etc.)
- gross_total_income: Gross total income (number only)
- total_deductions: Total deductions claimed (number only)
- taxable_income: Total taxable income (number only)
- tax_payable: Total tax payable (number only)
- tax_paid: Tax already paid/TDS (number only)
- refund_due: Refund due if any (number only, 0 if not applicable)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, documentType, filePath } = await req.json();
    console.log(`[ParseDocument] Processing: ${documentType}, ID: ${documentId}`);

    if (!documentId || !documentType || !filePath) {
      throw new Error("Missing required parameters: documentId, documentType, filePath");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download the document from storage
    console.log(`[ParseDocument] Downloading file: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("loan-documents")
      .download(filePath);

    if (downloadError) {
      console.error(`[ParseDocument] Download error:`, downloadError);
      throw new Error(`Failed to download document: ${downloadError.message}`);
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Detect file type from path or content
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const isPdf = fileExtension === 'pdf' || fileData.type === 'application/pdf';
    const mimeType = isPdf ? 'application/pdf' : (fileData.type || "image/jpeg");

    console.log(`[ParseDocument] File size: ${arrayBuffer.byteLength}, MIME: ${mimeType}, isPDF: ${isPdf}`);

    // Get the appropriate prompt for this document type
    const prompt = DOCUMENT_PROMPTS[documentType] || `Extract all relevant information from this document and return as JSON.`;

    // Call Lovable AI with vision capabilities
    // Gemini 2.5 Flash supports both images and PDFs natively
    console.log(`[ParseDocument] Calling Lovable AI for parsing...`);
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[ParseDocument] AI API error: ${aiResponse.status}`, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits exhausted. Please add funds to continue.");
      }
      throw new Error(`AI parsing failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    console.log(`[ParseDocument] AI response received, length: ${content.length}`);

    // Parse the JSON from the response
    let parsedData: Record<string, any> = {};
    try {
      // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      parsedData = JSON.parse(jsonStr);
      console.log(`[ParseDocument] Parsed data:`, JSON.stringify(parsedData).substring(0, 500));
    } catch (parseError) {
      console.error(`[ParseDocument] JSON parse error:`, parseError);
      // Store raw content if JSON parsing fails
      parsedData = { raw_text: content, parse_error: true };
    }

    // Update the document with parsed data
    const { error: updateError } = await supabase
      .from("loan_documents")
      .update({
        ocr_data: {
          ...parsedData,
          parsed_at: new Date().toISOString(),
          document_type: documentType,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      console.error(`[ParseDocument] Update error:`, updateError);
      throw new Error(`Failed to save parsed data: ${updateError.message}`);
    }

    console.log(`[ParseDocument] Successfully parsed and saved data for document ${documentId}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[ParseDocument] Error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});