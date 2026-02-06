import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RATE_LIMIT_WEBHOOKS_PER_MINUTE = 100;

// Legacy flat payload format
interface ExotelFlatPayload {
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

// Nested Exotel WhatsApp payload format
interface ExotelNestedMessage {
  callback_type: 'incoming_message' | 'dlr';
  sid: string;
  from?: string;
  to?: string;
  profile_name?: string;
  timestamp?: string;
  content?: {
    type: 'text' | 'button' | 'image' | 'document' | 'video' | 'audio' | 'sticker';
    text?: { body: string };
    button?: { payload: string; text: string };
    image?: { url: string; caption?: string; mime_type?: string };
    document?: { url: string; caption?: string; filename?: string; mime_type?: string };
    video?: { url: string; caption?: string; mime_type?: string };
    audio?: { url: string; mime_type?: string };
    sticker?: { url: string; mime_type?: string };
  };
  exo_status_code?: number;
  exo_detailed_status?: string;
  description?: string;
}

interface ExotelNestedPayload {
  whatsapp: {
    messages: ExotelNestedMessage[];
  };
}

// Normalized message structure for processing
interface NormalizedMessage {
  type: 'inbound' | 'dlr' | 'unknown';
  sid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  profileName: string;
  timestamp: string | null;
  errorMessage: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
}

// Map Exotel status codes to our status strings
const EXOTEL_STATUS_MAP: Record<number, string> = {
  30001: 'sent',        // EX_MESSAGE_SENT
  30002: 'delivered',   // EX_MESSAGE_DELIVERED
  30003: 'read',        // EX_MESSAGE_SEEN
  30004: 'failed',      // EX_MESSAGE_FAILED
  30005: 'failed',      // EX_MESSAGE_EXPIRED
};

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

// Validate webhook payload - accepts both nested and flat formats
function validateWebhookPayload(payload: any): boolean {
  // Accept nested Exotel format
  if (payload?.whatsapp?.messages?.length > 0) {
    return true;
  }
  // Accept legacy flat format
  return (
    payload &&
    (typeof payload.sid === 'string' || typeof payload.id === 'string') &&
    (typeof payload.to === 'string' || typeof payload.from === 'string')
  );
}

// Parse and normalize Exotel payload from either nested or flat format
function parseExotelPayload(payload: any): NormalizedMessage | null {
  // Check for nested format (new Exotel WhatsApp API)
  if (payload?.whatsapp?.messages?.[0]) {
    const msg = payload.whatsapp.messages[0] as ExotelNestedMessage;
    
    // Determine message type from callback_type
    let type: 'inbound' | 'dlr' | 'unknown' = 'unknown';
    if (msg.callback_type === 'incoming_message') {
      type = 'inbound';
    } else if (msg.callback_type === 'dlr') {
      type = 'dlr';
    }
    
    // Extract message body and media from content
    let body = '';
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    
    const contentType = msg.content?.type;
    
    if (contentType === 'text' && msg.content?.text?.body) {
      body = msg.content.text.body;
    } else if (contentType === 'button' && msg.content?.button?.text) {
      body = msg.content.button.text;
    } else if (contentType === 'image' && msg.content?.image) {
      mediaUrl = msg.content.image.url || null;
      mediaType = 'image';
      body = msg.content.image.caption || '[Image]';
    } else if (contentType === 'document' && msg.content?.document) {
      mediaUrl = msg.content.document.url || null;
      mediaType = 'document';
      body = msg.content.document.caption || msg.content.document.filename || '[Document]';
    } else if (contentType === 'video' && msg.content?.video) {
      mediaUrl = msg.content.video.url || null;
      mediaType = 'video';
      body = msg.content.video.caption || '[Video]';
    } else if (contentType === 'audio' && msg.content?.audio) {
      mediaUrl = msg.content.audio.url || null;
      mediaType = 'audio';
      body = '[Audio]';
    } else if (contentType === 'sticker' && msg.content?.sticker) {
      mediaUrl = msg.content.sticker.url || null;
      mediaType = 'sticker';
      body = '[Sticker]';
    }
    
    // Map Exotel status code to our status string for DLR
    let status = '';
    if (type === 'dlr' && msg.exo_status_code) {
      status = EXOTEL_STATUS_MAP[msg.exo_status_code] || 'unknown';
    }
    
    return {
      type,
      sid: msg.sid || '',
      from: msg.from || '',
      to: msg.to || '',
      body,
      status,
      profileName: msg.profile_name || '',
      timestamp: msg.timestamp || null,
      errorMessage: msg.description || null,
      mediaUrl,
      mediaType,
    };
  }
  
  // Legacy flat format fallback
  if (payload?.sid || payload?.id) {
    const flat = payload as ExotelFlatPayload;
    const direction = flat.direction?.toLowerCase();
    
    return {
      type: direction === 'inbound' ? 'inbound' : (flat.status ? 'dlr' : 'unknown'),
      sid: flat.sid || flat.id || '',
      from: flat.from || '',
      to: flat.to || '',
      body: flat.body || '',
      status: flat.status?.toLowerCase() || '',
      profileName: '',
      timestamp: flat.timestamp || null,
      errorMessage: flat.error_message || flat.error_code || null,
      mediaUrl: null,
      mediaType: null,
    };
  }
  
  return null;
}

// Normalize phone number to consistent format with + prefix
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure + prefix for storage
  if (!cleaned.startsWith('+')) {
    // If it's a 10-digit Indian number, add +91
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
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

    // Parse and normalize the payload
    const normalizedMsg = parseExotelPayload(payload);
    
    if (!normalizedMsg) {
      console.error('Failed to parse webhook payload:', payload);
      return new Response(
        JSON.stringify({ error: 'Failed to parse payload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Normalized message:', JSON.stringify(normalizedMsg, null, 2));

    // Log rate limit
    await supabaseClient
      .from('rate_limit_log')
      .insert({
        org_id: null,
        operation: 'webhook_whatsapp',
        ip_address: clientIp,
      });

    // Handle inbound messages (new messages from customers)
    // Accept messages with either text body OR media
    if (normalizedMsg.type === 'inbound' && (normalizedMsg.body || normalizedMsg.mediaUrl)) {
      console.log('Processing inbound message:', normalizedMsg);
      
      const phoneNumber = normalizePhoneNumber(normalizedMsg.from);
      
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
        
        // Use profile_name from Exotel if available, otherwise use phone number
        const firstName = normalizedMsg.profileName || phoneNumber;
        
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
      
      // Store inbound message with media fields
      const { error: insertError } = await supabaseClient
        .from('whatsapp_messages')
        .insert({
          org_id: orgId,
          contact_id: contactId,
          conversation_id: phoneNumber,
          direction: 'inbound',
          message_content: normalizedMsg.body,
          phone_number: phoneNumber,
          exotel_message_id: normalizedMsg.sid,
          status: 'received',
          sent_at: normalizedMsg.timestamp ? new Date(normalizedMsg.timestamp) : new Date(),
          media_url: normalizedMsg.mediaUrl,
          media_type: normalizedMsg.mediaType,
        });
      
      if (insertError) {
        console.error('Error inserting inbound message:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Stored inbound message from:', phoneNumber, 'content:', normalizedMsg.body, 'mediaType:', normalizedMsg.mediaType);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Inbound message stored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle delivery reports (DLR) - status updates for outbound messages
    if (normalizedMsg.type === 'dlr' && normalizedMsg.status && normalizedMsg.sid) {
      console.log('Processing DLR:', normalizedMsg);
      
      const timestamp = normalizedMsg.timestamp ? new Date(normalizedMsg.timestamp) : new Date();

      // Find the message by exotel_message_id
      const { data: message, error: fetchError } = await supabaseClient
        .from('whatsapp_messages')
        .select('*')
        .eq('exotel_message_id', normalizedMsg.sid)
        .single();

      if (fetchError || !message) {
        console.error('Message not found for DLR:', normalizedMsg.sid, fetchError);
        // Don't return 404 for DLR - just acknowledge
        return new Response(
          JSON.stringify({ success: true, message: 'DLR received but message not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prepare update data based on status
      const updateData: any = { status: normalizedMsg.status };

      if (normalizedMsg.status === 'delivered' || normalizedMsg.status === 'sent') {
        updateData.delivered_at = timestamp.toISOString();
      } else if (normalizedMsg.status === 'read') {
        updateData.read_at = timestamp.toISOString();
        if (!message.delivered_at) {
          updateData.delivered_at = timestamp.toISOString();
        }
      } else if (normalizedMsg.status === 'failed') {
        updateData.error_message = normalizedMsg.errorMessage || 'Message delivery failed';
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

      console.log(`Updated message ${message.id} to status: ${normalizedMsg.status}`);

      return new Response(
        JSON.stringify({ success: true, message: 'Status updated' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For other webhook types or unknown, just acknowledge
    console.log('Webhook type not handled, acknowledging:', normalizedMsg?.type);
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
