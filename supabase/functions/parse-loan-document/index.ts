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

  bank_statement: `Extract the following from this bank statement:
- account_number: Bank account number
- account_holder_name: Account holder name exactly as shown
- ifsc_code: IFSC code of the branch
- bank_name: Name of the bank
- branch_name: Branch name and address
- statement_period_from: Statement start date (YYYY-MM-DD)
- statement_period_to: Statement end date (YYYY-MM-DD)
- opening_balance: Opening balance (number only)
- closing_balance: Closing balance (number only)
- total_credits: Total credits/deposits (number only)
- total_debits: Total debits/withdrawals (number only)
- average_monthly_balance: Average monthly balance if visible (number only)
- salary_credits: Total salary/regular income credits (number only)
- emi_debits: Total EMI/loan debits (number only)
- bounce_count: Number of bounced transactions/insufficient fund instances (number only, 0 if none)
Return ONLY valid JSON with these fields. Use 0 or null for missing values.`,

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

  disbursement_proof: `Extract the following from this UTR/disbursement proof document (bank transfer screenshot, NEFT/RTGS confirmation, payment receipt):
- utr_number: The UTR (Unique Transaction Reference) number or transaction reference ID
- transaction_date: The date of the transaction (YYYY-MM-DD format)
- amount: The transferred amount (number only)
- beneficiary_name: Name of the beneficiary/payee
- beneficiary_account: Beneficiary account number if visible
- bank_name: Bank name if visible
- transaction_status: Transaction status (e.g., "Success", "Completed", "Processed")
Return ONLY valid JSON with these fields. Use null for missing values.`,

  utr_proof: `Extract the following from this UTR/disbursement proof document (bank transfer screenshot, NEFT/RTGS confirmation, payment receipt):
- utr_number: The UTR (Unique Transaction Reference) number or transaction reference ID
- transaction_date: The date of the transaction (YYYY-MM-DD format)
- amount: The transferred amount (number only)
- beneficiary_name: Name of the beneficiary/payee
- beneficiary_account: Beneficiary account number if visible
- bank_name: Bank name if visible
- transaction_status: Transaction status (e.g., "Success", "Completed", "Processed")
Return ONLY valid JSON with these fields. Use null for missing values.`,

  rental_agreement: `Extract the following from this Rental Agreement:
- landlord_name: Name of the landlord/owner
- tenant_name: Name of the tenant/renter
- property_address: Complete address of the rented property
- rent_amount: Monthly rent amount (number only)
- security_deposit: Security deposit paid (number only)
- agreement_start_date: Start date of agreement (YYYY-MM-DD)
- agreement_end_date: End date of agreement (YYYY-MM-DD)
- agreement_duration: Duration in months (number only)
- registration_number: Registration number if registered
Return ONLY valid JSON with these fields. Use null for missing values.`,

  utility_bill: `Extract the following from this Utility Bill:
- customer_name: Name of the customer/account holder
- service_address: Service address shown on bill
- bill_date: Bill date (YYYY-MM-DD)
- due_date: Payment due date (YYYY-MM-DD)
- bill_amount: Total bill amount (number only)
- utility_type: Type of utility (Electricity/Water/Gas/Internet)
- account_number: Customer/account number
- provider_name: Utility provider/company name
Return ONLY valid JSON with these fields. Use null for missing values.`,
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

    // Fetch the document to get loan_application_id for syncing
    const { data: docRecord, error: docFetchError } = await supabase
      .from("loan_documents")
      .select("loan_application_id")
      .eq("id", documentId)
      .single();

    if (docFetchError) {
      console.warn(`[ParseDocument] Could not fetch document record:`, docFetchError);
    }
    const loanApplicationId = docRecord?.loan_application_id;
    console.log(`[ParseDocument] Loan Application ID: ${loanApplicationId}`);

    // Download the document from storage
    console.log(`[ParseDocument] Downloading file: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("loan-documents")
      .download(filePath);

    if (downloadError) {
      console.error(`[ParseDocument] Download error:`, downloadError);
      throw new Error(`Failed to download document: ${downloadError.message}`);
    }

    // Convert to base64 without using spread (avoids "Maximum call stack size" for large files)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Detect file type from path or content
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const isPdf = fileExtension === 'pdf' || fileData.type === 'application/pdf';
    
    console.log(`[ParseDocument] File size: ${arrayBuffer.byteLength}, isPDF: ${isPdf}`);

    // Get the appropriate prompt for this document type
    const prompt = DOCUMENT_PROMPTS[documentType] || `Extract all relevant information from this document and return as JSON.`;

    let aiResponse: Response;

    if (isPdf) {
      // For PDFs, use Gemini with file upload approach via inline_data
      // Gemini supports PDFs via the generativeai format with inline_data
      console.log(`[ParseDocument] Using Gemini Pro for PDF parsing...`);
      
      // Use google/gemini-2.5-pro which has better PDF support
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: filePath.split('/').pop() || "document.pdf",
                    file_data: `data:application/pdf;base64,${base64}`,
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
    } else {
      // For images, use the standard image_url approach
      const mimeType = fileData.type || "image/jpeg";
      console.log(`[ParseDocument] Using Gemini Flash for image parsing, MIME: ${mimeType}`);
      
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    }

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

    // === Sync OCR data to loan_applicants for Aadhaar/PAN ===
    const isAadhaarOrPan = documentType === 'aadhaar_card' || documentType === 'aadhar_card' || documentType === 'pan_card';
    
    if (isAadhaarOrPan && !parsedData.parse_error && loanApplicationId) {
      console.log(`[ParseDocument] Syncing OCR data to loan_applicants for ${documentType}`);
      
      // Find the primary applicant for this application
      const { data: applicant, error: applicantFetchError } = await supabase
        .from("loan_applicants")
        .select("id, dob, current_address, gender")
        .eq("loan_application_id", loanApplicationId)
        .eq("applicant_type", "primary")
        .maybeSingle();
      
      if (applicant && !applicantFetchError) {
        const updateData: Record<string, unknown> = {};
        
        // Sync DOB if currently default placeholder
        if (parsedData.dob && applicant.dob === '1990-01-01') {
          // Validate and format DOB
          const dobDate = new Date(parsedData.dob);
          if (!isNaN(dobDate.getTime())) {
            updateData.dob = parsedData.dob;
          }
        }
        
        // Sync gender from Aadhaar if not set
        if (documentType === 'aadhaar_card' || documentType === 'aadhar_card') {
          if (parsedData.gender && !applicant.gender) {
            updateData.gender = parsedData.gender;
          }
          
          // Sync address if not set (or is null)
          if (parsedData.address && !applicant.current_address) {
            const addressStr = parsedData.address;
            
            // Extract pincode (6 digits at end)
            const pincodeMatch = addressStr.match(/(\d{6})\s*$/);
            const pincode = pincodeMatch ? pincodeMatch[1] : '';
            
            // Extract state (common Indian states)
            const statePatterns = [
              'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
              'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
              'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
              'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
              'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
              'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry'
            ];
            let state = '';
            for (const s of statePatterns) {
              if (addressStr.toLowerCase().includes(s.toLowerCase())) {
                state = s;
                break;
              }
            }
            
            // Build structured address
            updateData.current_address = {
              line1: addressStr, // Full address as line1
              line2: '',
              city: '',
              state: state,
              pincode: pincode
            };
            
            console.log(`[ParseDocument] Extracted address - state: ${state}, pincode: ${pincode}`);
          }
        }
        
        // Perform update if we have changes
        if (Object.keys(updateData).length > 0) {
          const { error: syncError } = await supabase
            .from("loan_applicants")
            .update(updateData)
            .eq("id", applicant.id);
          
          if (syncError) {
            console.warn(`[ParseDocument] Failed to sync OCR to applicant:`, syncError);
          } else {
            console.log(`[ParseDocument] Synced OCR data to applicant:`, updateData);
          }
        } else {
          console.log(`[ParseDocument] No updates needed for applicant (values already set)`);
        }
      } else {
        console.log(`[ParseDocument] No primary applicant found for application ${loanApplicationId}`);
      }
    }

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
