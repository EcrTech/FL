import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, roomId } = await req.json();

    if (!token || !roomId) {
      throw new Error('Token and roomId are required');
    }

    // Start recording via VideoSDK API
    const response = await fetch(`https://api.videosdk.live/v2/recordings/start`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomId: roomId,
        config: {
          layout: {
            type: 'GRID',
            priority: 'SPEAKER',
            gridSize: 2
          },
          theme: 'DARK',
          quality: 'high'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VideoSDK API error:', response.status, errorText);
      throw new Error(`Failed to start recording: ${errorText}`);
    }

    const data = await response.json();
    console.log('Started recording for room:', roomId);

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error starting recording:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to start recording' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
