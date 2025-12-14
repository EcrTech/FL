import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, fileType } = await req.json();

    if (!fileBase64) {
      throw new Error('No file provided');
    }

    console.log('[Parse PAN Document] Processing document, type:', fileType);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('AI service not configured');
    }

    // Use Lovable AI gateway with Gemini model
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a document parser. Extract the following details from this PAN card image:
1. PAN Number (10 character alphanumeric code in format ABCDE1234F)
2. Name as printed on the PAN card
3. Father's Name (if visible)
4. Date of Birth (if visible)

Return ONLY a JSON object in this exact format, no other text:
{
  "panNumber": "EXTRACTED_PAN_OR_NULL",
  "name": "EXTRACTED_NAME_OR_NULL",
  "fatherName": "EXTRACTED_FATHER_NAME_OR_NULL",
  "dateOfBirth": "EXTRACTED_DOB_OR_NULL",
  "confidence": "high/medium/low"
}

If this is not a PAN card or you cannot extract the details, return:
{
  "error": "Could not extract PAN details from this document",
  "confidence": "low"
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: fileBase64.startsWith('data:') ? fileBase64 : `data:${fileType || 'image/jpeg'};base64,${fileBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Parse PAN Document] AI API error:', errorText);
      throw new Error('Failed to process document');
    }

    const result = await response.json();
    console.log('[Parse PAN Document] AI response received');

    // Extract the text response
    const textContent = result.choices?.[0]?.message?.content;
    
    if (!textContent) {
      throw new Error('No response from AI model');
    }

    // Parse the JSON from the response
    let parsedData;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[Parse PAN Document] Failed to parse response:', textContent);
      throw new Error('Failed to parse document details');
    }

    // Validate PAN format if extracted
    if (parsedData.panNumber && parsedData.panNumber !== 'null') {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(parsedData.panNumber)) {
        parsedData.panNumber = null;
        parsedData.confidence = 'low';
      }
    } else {
      parsedData.panNumber = null;
    }

    // Clean up null strings
    if (parsedData.name === 'null' || parsedData.name === 'NULL') parsedData.name = null;
    if (parsedData.fatherName === 'null' || parsedData.fatherName === 'NULL') parsedData.fatherName = null;
    if (parsedData.dateOfBirth === 'null' || parsedData.dateOfBirth === 'NULL') parsedData.dateOfBirth = null;

    console.log('[Parse PAN Document] Extracted:', { 
      panNumber: parsedData.panNumber ? parsedData.panNumber.substring(0, 4) + '****' : null,
      hasName: !!parsedData.name,
      confidence: parsedData.confidence 
    });

    return new Response(
      JSON.stringify({
        success: !parsedData.error && !!parsedData.panNumber,
        ...parsedData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Parse PAN Document] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse document',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
