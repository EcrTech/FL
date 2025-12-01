import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, roomId, verificationId, orgId, applicationId } = await req.json();

    if (!token || !roomId) {
      throw new Error('Token and roomId are required');
    }

    // Stop recording via VideoSDK API
    const stopResponse = await fetch(`https://api.videosdk.live/v2/recordings/stop`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomId: roomId
      })
    });

    if (!stopResponse.ok) {
      const errorText = await stopResponse.text();
      console.error('VideoSDK API error:', stopResponse.status, errorText);
      throw new Error(`Failed to stop recording: ${errorText}`);
    }

    const stopData = await stopResponse.json();
    console.log('Stopped recording for room:', roomId);

    // Wait a bit for recording to be processed
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get recording details
    const recordingsResponse = await fetch(`https://api.videosdk.live/v2/recordings?roomId=${roomId}`, {
      method: 'GET',
      headers: {
        'Authorization': token
      }
    });

    let recordingUrl = null;
    if (recordingsResponse.ok) {
      const recordingsData = await recordingsResponse.json();
      console.log('Recordings data:', recordingsData);
      
      if (recordingsData.data && recordingsData.data.length > 0) {
        const recording = recordingsData.data[0];
        recordingUrl = recording.file?.fileUrl || recording.file?.url;
      }
    }

    // Save to database if verification details provided
    if (verificationId && orgId && applicationId) {
      const supabase = getSupabaseClient();
      
      const { error: updateError } = await supabase
        .from('loan_verifications')
        .update({
          response_data: {
            roomId: roomId,
            recordingUrl: recordingUrl,
            stoppedAt: new Date().toISOString()
          },
          status: recordingUrl ? 'success' : 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', verificationId);

      if (updateError) {
        console.error('Error updating verification:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        ...stopData,
        recordingUrl
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error stopping recording:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to stop recording' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
