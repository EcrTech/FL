 import { getSupabaseClient } from '../_shared/supabaseClient.ts';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 interface SendSmsPayload {
   orgId: string;
   phoneNumber: string;
  messageContent?: string;
   templateId?: string;
   templateVariables?: Record<string, string>;
   dltTemplateId?: string;
   contactId?: string;
   loanApplicationId?: string;
   triggerType?: 'manual' | 'automation' | 'system';
   sentBy?: string;
   executionId?: string;
 }
 
interface SMSTemplate {
  id: string;
  name: string;
  dlt_template_id: string;
  content: string;
  variables: Array<{ dlt_var: string; name: string; description: string }>;
}

 interface ExotelSettings {
   api_key: string;
   api_token: string;
   account_sid: string;
   subdomain: string;
   sms_sender_id: string;
   dlt_entity_id: string;
   is_active: boolean;
 }
 
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabase = getSupabaseClient();
     const payload: SendSmsPayload = await req.json();
     
     console.log('[send-sms] Received request:', {
       orgId: payload.orgId,
       phoneNumber: payload.phoneNumber,
       triggerType: payload.triggerType,
     });
 
     const {
       orgId,
       phoneNumber,
       messageContent,
       templateId,
       templateVariables = {},
       dltTemplateId,
       contactId,
       loanApplicationId,
       triggerType = 'manual',
       sentBy,
       executionId,
     } = payload;
 
     // Validate required fields
    if (!orgId || !phoneNumber) {
       return new Response(
        JSON.stringify({ error: 'Missing required fields: orgId, phoneNumber' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
       );
     }

    // Fetch template if templateId is provided
    let smsTemplate: SMSTemplate | null = null;
    let actualDltTemplateId = dltTemplateId;
    let baseContent = messageContent || '';
    
    if (templateId) {
      const { data: template, error: templateError } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (templateError) {
        console.error('[send-sms] Failed to fetch template:', templateError);
      } else if (template) {
        smsTemplate = template as SMSTemplate;
        baseContent = smsTemplate.content;
        actualDltTemplateId = smsTemplate.dlt_template_id;
        console.log('[send-sms] Using template:', smsTemplate.name);
      }
    }

    if (!baseContent) {
      return new Response(
        JSON.stringify({ error: 'No message content provided and no valid template found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
 
     // Fetch Exotel settings for the organization
     const { data: exotelSettings, error: settingsError } = await supabase
       .from('exotel_settings')
       .select('*')
       .eq('org_id', orgId)
       .single();
 
     if (settingsError || !exotelSettings) {
       console.error('[send-sms] Exotel settings not found:', settingsError);
       return new Response(
         JSON.stringify({ error: 'Exotel settings not configured for this organization' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
       );
     }
 
     if (!exotelSettings.is_active) {
       return new Response(
         JSON.stringify({ error: 'Exotel integration is not active' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
       );
     }
 
     // Check SMS-specific settings
     if (!exotelSettings.sms_sender_id) {
       return new Response(
         JSON.stringify({ error: 'SMS Sender ID not configured in Exotel settings' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
       );
     }
 
     // Process message content with template variables
    let finalMessage = baseContent;
    
    // Handle DLT variable substitution if template has variable mappings
    if (smsTemplate?.variables && templateVariables) {
      for (const varMapping of smsTemplate.variables) {
        const systemValue = templateVariables[varMapping.name];
        if (systemValue !== undefined) {
          const dltPattern = new RegExp(`\\{#${varMapping.dlt_var}#\\}`, 'gi');
          finalMessage = finalMessage.replace(dltPattern, systemValue);
        }
      }
    }
    
   // Handle direct {#var#} DLT placeholder replacement when no template mapping exists
   if (templateVariables && Object.keys(templateVariables).length > 0) {
     for (const [key, value] of Object.entries(templateVariables)) {
       // Replace {#key#} format (DLT standard)
       finalMessage = finalMessage.replace(new RegExp(`\\{#${key}#\\}`, 'gi'), value);
     }
   }
   
    // Also handle standard {{variable}} format for backward compatibility
     if (templateVariables && Object.keys(templateVariables).length > 0) {
       for (const [key, value] of Object.entries(templateVariables)) {
         finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, 'gi'), value);
       }
     }
 
     // Format phone number (ensure +91 prefix for Indian numbers)
     let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/-/g, '');
     if (!formattedPhone.startsWith('+')) {
       if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
         formattedPhone = '+' + formattedPhone;
       } else if (formattedPhone.length === 10) {
         formattedPhone = '+91' + formattedPhone;
       }
     }
 
     // Create SMS record first
     const { data: smsRecord, error: smsInsertError } = await supabase
       .from('sms_messages')
       .insert({
         org_id: orgId,
         contact_id: contactId || null,
         loan_application_id: loanApplicationId || null,
         phone_number: formattedPhone,
         message_content: finalMessage,
         template_id: templateId || null,
         template_variables: templateVariables,
          dlt_template_id: actualDltTemplateId || null,
         status: 'pending',
         trigger_type: triggerType,
         sent_by: sentBy || null,
       })
       .select()
       .single();
 
     if (smsInsertError) {
       console.error('[send-sms] Failed to create SMS record:', smsInsertError);
       return new Response(
         JSON.stringify({ error: 'Failed to create SMS record' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
       );
     }
 
     console.log('[send-sms] Created SMS record:', smsRecord.id);
 
     try {
       // Build Exotel SMS API request
       const settings: ExotelSettings = exotelSettings as ExotelSettings;
       const auth = btoa(`${settings.api_key}:${settings.api_token}`);
       const subdomain = settings.subdomain || 'api.exotel.com';
       
       // Build form data for SMS
       const formData = new URLSearchParams();
       formData.append('From', settings.sms_sender_id);
       formData.append('To', formattedPhone);
       formData.append('Body', finalMessage);
       
       // Add DLT compliance fields
       if (settings.dlt_entity_id) {
         formData.append('DltEntityId', settings.dlt_entity_id);
       }
      if (actualDltTemplateId) {
        formData.append('DltTemplateId', actualDltTemplateId);
       }
 
       const exotelUrl = `https://${subdomain}/v1/Accounts/${settings.account_sid}/Sms/send.json`;
       
       console.log('[send-sms] Sending to Exotel:', exotelUrl);
       
       const exotelResponse = await fetch(exotelUrl, {
         method: 'POST',
         headers: {
           'Authorization': `Basic ${auth}`,
           'Content-Type': 'application/x-www-form-urlencoded',
         },
         body: formData.toString(),
       });
 
       const responseData = await exotelResponse.json();
       console.log('[send-sms] Exotel response:', responseData);
 
       if (!exotelResponse.ok) {
         // Update SMS record with failure
         await supabase
           .from('sms_messages')
           .update({
             status: 'failed',
             error_message: responseData.RestException?.Message || 'Exotel API error',
           })
           .eq('id', smsRecord.id);
 
         // Update execution if exists
         if (executionId) {
           await supabase
             .from('sms_automation_executions')
             .update({
               status: 'failed',
               error_message: responseData.RestException?.Message || 'Exotel API error',
             })
             .eq('id', executionId);
         }
 
         return new Response(
           JSON.stringify({ 
             error: 'Exotel API error',
             details: responseData.RestException?.Message || 'Unknown error'
           }),
           { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
         );
       }
 
       // Extract Exotel SID from response
       const exotelSid = responseData.SMSMessage?.Sid || responseData.Sid;
 
       // Update SMS record with success
       await supabase
         .from('sms_messages')
         .update({
           status: 'sent',
           exotel_sid: exotelSid,
           sent_at: new Date().toISOString(),
         })
         .eq('id', smsRecord.id);
 
       // Update execution if exists
       if (executionId) {
         await supabase
           .from('sms_automation_executions')
           .update({
             status: 'sent',
             sms_message_id: smsRecord.id,
             sent_at: new Date().toISOString(),
           })
           .eq('id', executionId);
       }
 
       console.log('[send-sms] SMS sent successfully:', exotelSid);
 
       return new Response(
         JSON.stringify({
           success: true,
           smsId: smsRecord.id,
           exotelSid: exotelSid,
         }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
       );
 
     } catch (sendError: any) {
       console.error('[send-sms] Error sending SMS:', sendError);
 
       // Update SMS record with failure
       await supabase
         .from('sms_messages')
         .update({
           status: 'failed',
           error_message: sendError.message || 'Failed to send SMS',
         })
         .eq('id', smsRecord.id);
 
       return new Response(
         JSON.stringify({ error: sendError.message || 'Failed to send SMS' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
       );
     }
 
   } catch (error: any) {
     console.error('[send-sms] Unexpected error:', error);
     return new Response(
       JSON.stringify({ error: error.message }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
     );
   }
 });