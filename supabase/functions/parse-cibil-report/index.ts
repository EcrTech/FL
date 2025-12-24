import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { filePath, applicationId } = await req.json();

    if (!filePath) {
      throw new Error("File path is required");
    }

    console.log("Parsing CIBIL report:", filePath);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("loan-documents")
      .download(filePath);

    if (downloadError) {
      console.error("Download error:", downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert file to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Determine file type
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    const mimeType = fileExtension === 'pdf' 
      ? 'application/pdf' 
      : fileExtension === 'png' 
        ? 'image/png' 
        : 'image/jpeg';

    console.log("File type:", mimeType, "Size:", arrayBuffer.byteLength);

    // Use AI to parse the CIBIL report
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    
    const prompt = `You are an expert at parsing CIBIL/Credit Bureau reports. Analyze this document and extract the following information in JSON format:

{
  "credit_score": <number between 300-900, or null if not found>,
  "bureau_type": "<cibil|experian|equifax|crif - identify which bureau this report is from>",
  "active_accounts": <number of active loan/credit accounts, or 0>,
  "total_outstanding": <total outstanding amount in INR as number, or 0>,
  "total_overdue": <total overdue amount in INR as number, or 0>,
  "enquiry_count_30d": <number of credit enquiries in last 30 days, or 0>,
  "enquiry_count_90d": <number of credit enquiries in last 90 days, or 0>,
  "dpd_history": "<summary of Days Past Due history, e.g. 'No DPD in last 12 months' or '30+ DPD twice in last 24 months'>",
  "account_summary": {
    "secured_accounts": <number>,
    "unsecured_accounts": <number>,
    "closed_accounts": <number>
  },
  "report_date": "<date of the report in YYYY-MM-DD format if found, or null>",
  "name_on_report": "<name as it appears on the report>",
  "pan_on_report": "<PAN number if visible, or null>",
  "remarks": "<any important observations about credit health>"
}

Return ONLY the JSON object, no additional text. If a field cannot be determined, use null for strings and 0 for numbers.`;

    let parsedData;

    if (geminiApiKey) {
      // Use Gemini API for parsing
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API error:", errorText);
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const geminiResult = await geminiResponse.json();
      const responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new Error("No response from AI model");
      }

      console.log("AI Response:", responseText);

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response as JSON");
      }
    } else {
      // Fallback: Use Lovable AI proxy
      const lovableResponse = await fetch(
        "https://llm.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY") || ""}`
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { 
                    type: "image_url", 
                    image_url: { 
                      url: `data:${mimeType};base64,${base64Data}` 
                    } 
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 2048,
          })
        }
      );

      if (!lovableResponse.ok) {
        const errorText = await lovableResponse.text();
        console.error("Lovable AI error:", errorText);
        throw new Error(`AI parsing failed: ${lovableResponse.status}`);
      }

      const lovableResult = await lovableResponse.json();
      const responseText = lovableResult.choices?.[0]?.message?.content;

      if (!responseText) {
        throw new Error("No response from AI model");
      }

      console.log("AI Response:", responseText);

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response as JSON");
      }
    }

    console.log("Parsed CIBIL data:", parsedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData,
        filePath 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error parsing CIBIL report:", errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
