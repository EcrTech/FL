 import { getSupabaseClient } from '../_shared/supabaseClient.ts';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 /**
  * SMS Webhook Handler for Exotel Delivery Reports
  * 
  * Exotel sends delivery status updates to this webhook.
  * Status values: queued, sending, submitted, sent, failed-dnd, failed, failed-expired, delivered, undelivered
  */
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabase = getSupabaseClient();
     
     // Parse request body (Exotel sends form data or JSON)
     let data: Record<string, string> = {};
     
     const contentType = req.headers.get('content-type') || '';
     
     if (contentType.includes('application/x-www-form-urlencoded')) {
       const formData = await req.formData();
       formData.forEach((value, key) => {
         data[key] = String(value);
       });
     } else if (contentType.includes('application/json')) {
       data = await req.json();
     } else {
       // Try to parse as URL-encoded from URL query params
       const url = new URL(req.url);
       url.searchParams.forEach((value, key) => {
         data[key] = value;
       });
     }
 
     console.log('[sms-webhook] Received delivery report:', data);
 
     // Extract Exotel webhook fields
     const exotelSid = data.SmsSid || data.Sid || data.sms_sid;
     const status = data.Status || data.status;
     const deliveredTime = data.DeliveredTime || data.delivered_time;
     const errorCode = data.ErrorCode || data.error_code;
     const errorMessage = data.ErrorMessage || data.error_message;
 
     if (!exotelSid) {
       console.log('[sms-webhook] No SMS SID provided in webhook');
       return new Response(
         JSON.stringify({ message: 'No SMS SID provided' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
       );
     }
 
     // Find the SMS message by Exotel SID
     const { data: smsMessage, error: findError } = await supabase
       .from('sms_messages')
       .select('id, status')
       .eq('exotel_sid', exotelSid)
       .single();
 
     if (findError || !smsMessage) {
       console.log('[sms-webhook] SMS message not found for SID:', exotelSid);
       return new Response(
         JSON.stringify({ message: 'SMS message not found' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
       );
     }
 
     // Map Exotel status to our status
     const statusMapping: Record<string, string> = {
       'queued': 'queued',
       'sending': 'queued',
       'submitted': 'sent',
       'sent': 'sent',
       'delivered': 'delivered',
       'failed': 'failed',
       'failed-dnd': 'failed',
       'failed-expired': 'failed',
       'undelivered': 'undelivered',
     };
 
     const mappedStatus = statusMapping[status?.toLowerCase()] || smsMessage.status;
 
     // Prepare update object
     const updateData: Record<string, any> = {
       status: mappedStatus,
     };
 
     // Set delivered_at if status is delivered
     if (mappedStatus === 'delivered') {
       updateData.delivered_at = deliveredTime || new Date().toISOString();
     }
 
     // Set error message if failed
     if (mappedStatus === 'failed' || mappedStatus === 'undelivered') {
       updateData.error_message = errorMessage || errorCode || `Status: ${status}`;
     }
 
     // Update the SMS message
     const { error: updateError } = await supabase
       .from('sms_messages')
       .update(updateData)
       .eq('id', smsMessage.id);
 
     if (updateError) {
       console.error('[sms-webhook] Failed to update SMS status:', updateError);
       return new Response(
         JSON.stringify({ error: 'Failed to update SMS status' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
       );
     }
 
     console.log('[sms-webhook] Updated SMS status:', {
       smsId: smsMessage.id,
       oldStatus: smsMessage.status,
       newStatus: mappedStatus,
     });
 
     return new Response(
       JSON.stringify({ success: true, message: 'Status updated' }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
     );
 
   } catch (error: any) {
     console.error('[sms-webhook] Unexpected error:', error);
     return new Response(
       JSON.stringify({ error: error.message }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
     );
   }
 });