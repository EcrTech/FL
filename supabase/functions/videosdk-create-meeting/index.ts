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
    const { token } = await req.json();

    if (!token) {
      throw new Error('Token is required');
    }

    console.log('Creating meeting with token (first 20 chars):', token.substring(0, 20) + '...');

    // Create meeting room via VideoSDK API
    // VideoSDK expects the JWT token directly in Authorization header
    const response = await fetch('https://api.videosdk.live/v2/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const responseText = await response.text();
    console.log('VideoSDK API response status:', response.status);
    console.log('VideoSDK API response:', responseText);

    if (!response.ok) {
      console.error('VideoSDK API error:', response.status, responseText);
      throw new Error(`Failed to create meeting: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    console.log('Created VideoSDK meeting:', data.roomId);

    return new Response(
      JSON.stringify({ 
        roomId: data.roomId,
        meetingId: data.roomId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error creating meeting:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to create meeting' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
