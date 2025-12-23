import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_WEBHOOKS_PER_MINUTE = 100;

interface ExotelWebhookPayload {
  sid?: string;
  id?: string;
  to?: string;
  from?: string;
  body?: string;
  status?: string;
  direction?: string;
  timestamp?: string;
  error_code?: string;
  error_message?: string;
}

// Rate limiting for webhook calls (IP-based)
async function checkWebhookRateLimit(supabaseClient: any, ipAddress: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  
  const { count } = await supabaseClient
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .eq('operation', 'webhook_whatsapp')
    .gte('created_at', oneMinuteAgo);
  
  return (count || 0) < RATE_LIMIT_WEBHOOKS_PER_MINUTE;
}

// Validate webhook payload structure
function validateWebhookPayload(payload: any): payload is ExotelWebhookPayload {
  return (
    payload &&
    (typeof payload.sid === 'string' || typeof payload.id === 'string') &&
    (typeof payload.to === 'string' || typeof payload.from === 'string')
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = getSupabaseClient();

    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Check rate limit
    const withinLimit = await checkWebhookRateLimit(supabaseClient, clientIp);
    if (!withinLimit) {
      console.error('Webhook rate limit exceeded from IP:', clientIp);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: any = await req.json();
    
    console.log('Received Exotel webhook:', JSON.stringify(payload, null, 2));

    // Validate payload structure
    if (!validateWebhookPayload(payload)) {
      console.error('Invalid webhook payload structure:', payload);
      return new Response(
        JSON.stringify({ error: 'Invalid payload structure' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log rate limit
    await supabaseClient
      .from('rate_limit_log')
      .insert({
        org_id: null,
        operation: 'webhook_whatsapp',
        ip_address: clientIp,
      });

    const messageId = payload.sid || payload.id;
    const status = payload.status?.toLowerCase();
    const direction = payload.direction?.toLowerCase();
    
    // Handle inbound messages (new messages from customers)
    if (direction === 'inbound' && payload.body) {
      console.log('Received inbound message:', payload);
      
      const phoneNumber = payload.from?.replace(/[^\d+]/g, '') || '';
      
      // Find existing contact by phone number
      const { data: contacts } = await supabaseClient
        .from('contacts')
        .select('id, org_id')
        .eq('phone', phoneNumber)
        .limit(1);
      
      let contactId = contacts?.[0]?.id;
      let orgId = contacts?.[0]?.org_id;
      
      // If contact doesn't exist, try to auto-create
      if (!contactId || !orgId) {
        console.log('Contact not found for phone:', phoneNumber);
        
        // Get active WhatsApp settings to determine org
        const { data: whatsappSettings } = await supabaseClient
          .from('whatsapp_settings')
          .select('org_id')
          .eq('is_active', true)
          .limit(1);
        
        if (!whatsappSettings || whatsappSettings.length === 0) {
          console.log('No active WhatsApp settings found');
          return new Response(
            JSON.stringify({ success: true, message: 'No active WhatsApp org found, message ignored' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        orgId = whatsappSettings[0].org_id;
        console.log('Creating new contact for phone:', phoneNumber, 'in org:', orgId);
        
        // Use phone number as name since Exotel doesn't provide name
        const firstName = phoneNumber;
        
        // Create new contact
        const { data: newContact, error: createError } = await supabaseClient
          .from('contacts')
          .insert({
            org_id: orgId,
            phone: phoneNumber,
            first_name: firstName,
            source: 'whatsapp_inbound',
            status: 'new',
          })
          .select('id')
          .single();
        
        if (createError) {
          console.error('Error creating contact:', createError);
          return new Response(
            JSON.stringify({ error: 'Failed to create contact: ' + createError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        contactId = newContact.id;
        console.log('Created new contact:', contactId);
      }
      
      // Store inbound message
      const { error: insertError } = await supabaseClient
        .from('whatsapp_messages')
        .insert({
          org_id: orgId,
          contact_id: contactId,
          conversation_id: phoneNumber,
          direction: 'inbound',
          message_content: payload.body || '',
          phone_number: phoneNumber,
          exotel_message_id: messageId,
          status: 'received',
          sent_at: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        });
      
      if (insertError) {
        console.error('Error inserting inbound message:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Stored inbound message from:', phoneNumber);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Inbound message stored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle status updates for outbound messages
    if (status && messageId) {
      const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

      // Find the message by exotel_message_id
      const { data: message, error: fetchError } = await supabaseClient
        .from('whatsapp_messages')
        .select('*')
        .eq('exotel_message_id', messageId)
        .single();

      if (fetchError || !message) {
        console.error('Message not found:', messageId, fetchError);
        return new Response(
          JSON.stringify({ error: 'Message not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Prepare update data based on status
      const updateData: any = { status: status };

      if (status === 'delivered' || status === 'sent') {
        updateData.delivered_at = timestamp.toISOString();
      } else if (status === 'read') {
        updateData.read_at = timestamp.toISOString();
        if (!message.delivered_at) {
          updateData.delivered_at = timestamp.toISOString();
        }
      } else if (status === 'failed' || status === 'undelivered') {
        updateData.error_message = payload.error_message || payload.error_code || 'Message delivery failed';
      }

      // Update the message status
      const { error: updateError } = await supabaseClient
        .from('whatsapp_messages')
        .update(updateData)
        .eq('id', message.id);

      if (updateError) {
        console.error('Error updating message:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(`Updated message ${message.id} to status: ${status}`);

      return new Response(
        JSON.stringify({ success: true, message: 'Status updated' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For other webhook types, just acknowledge
    return new Response(
      JSON.stringify({ success: true, message: 'Webhook received' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
