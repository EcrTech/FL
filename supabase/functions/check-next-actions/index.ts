import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[NextActions] Starting next action check...');
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Get all organizations with their timezone settings
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, settings');
    
    if (orgsError) throw orgsError;
    
    let totalProcessed = 0;
    
    for (const org of orgs || []) {
      const timezone = org.settings?.timezone || 'UTC';
      console.log(`[NextActions] Processing org ${org.id} (timezone: ${timezone})`);
      
      // Get current time in org's timezone
      const orgNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const currentHour = orgNow.getHours();
      const currentMinutes = orgNow.getMinutes();
      
      // Calculate time windows for 9 AM and 1 hour before
      const morningWindowStart = new Date(orgNow);
      morningWindowStart.setHours(9, 0, 0, 0);
      const morningWindowEnd = new Date(morningWindowStart);
      morningWindowEnd.setMinutes(15); // 9:00-9:15 AM window
      
      const oneHourFromNow = new Date(orgNow);
      oneHourFromNow.setHours(orgNow.getHours() + 1);
      const preActionWindowStart = new Date(oneHourFromNow);
      preActionWindowStart.setMinutes(orgNow.getMinutes() - 7); // 7-minute window before 1 hour
      const preActionWindowEnd = new Date(oneHourFromNow);
      preActionWindowEnd.setMinutes(orgNow.getMinutes() + 8);
      
      // Find activities needing morning reminders (9 AM same day)
      if (currentHour === 9 && currentMinutes < 15) {
        const todayStart = new Date(orgNow);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(orgNow);
        todayEnd.setHours(23, 59, 59, 999);
        
        const { data: morningActivities, error: morningError } = await supabase
          .from('contact_activities')
          .select(`
            id,
            org_id,
            contact_id,
            activity_type,
            subject,
            next_action_date,
            next_action_notes,
            created_by,
            contacts(first_name, last_name, company)
          `)
          .eq('org_id', org.id)
          .gte('next_action_date', todayStart.toISOString())
          .lte('next_action_date', todayEnd.toISOString())
          .eq('morning_reminder_sent', false);
        
        if (morningError) {
          console.error(`[NextActions] Error fetching morning activities for org ${org.id}:`, morningError);
        } else {
          console.log(`[NextActions] Found ${morningActivities?.length || 0} morning reminders for org ${org.id}`);
          
          for (const activity of morningActivities || []) {
            await createNotification(supabase, activity, 'morning', timezone);
            totalProcessed++;
          }
        }
      }
      
      // Find activities needing pre-action reminders (1 hour before)
      const { data: preActionActivities, error: preActionError } = await supabase
        .from('contact_activities')
        .select(`
          id,
          org_id,
          contact_id,
          activity_type,
          subject,
          next_action_date,
          next_action_notes,
          created_by,
          contacts(first_name, last_name, company)
        `)
        .eq('org_id', org.id)
        .gte('next_action_date', preActionWindowStart.toISOString())
        .lte('next_action_date', preActionWindowEnd.toISOString())
        .eq('pre_action_reminder_sent', false);
      
      if (preActionError) {
        console.error(`[NextActions] Error fetching pre-action activities for org ${org.id}:`, preActionError);
      } else {
        console.log(`[NextActions] Found ${preActionActivities?.length || 0} pre-action reminders for org ${org.id}`);
        
        for (const activity of preActionActivities || []) {
          await createNotification(supabase, activity, 'pre_action', timezone);
          totalProcessed++;
        }
      }
    }
    
    console.log(`[NextActions] Successfully processed ${totalProcessed} notifications`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: totalProcessed,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[NextActions] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createNotification(supabase: any, activity: any, type: 'morning' | 'pre_action', timezone: string) {
  const contact = activity.contacts;
  const contactName = contact 
    ? `${contact.first_name} ${contact.last_name || ''}`.trim() || contact.company || 'Unknown'
    : 'Unknown';
  
  const actionDate = new Date(activity.next_action_date);
  const formattedDate = actionDate.toLocaleString('en-US', { 
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  const notification = {
    org_id: activity.org_id,
    user_id: activity.created_by,
    type: type === 'morning' ? 'next_action_morning' : 'next_action_urgent',
    title: type === 'morning' 
      ? `Today's Action: ${contactName}`
      : `Action Due Soon: ${contactName}`,
    message: activity.next_action_notes 
      ? `${formattedDate} - ${activity.next_action_notes}`
      : `Follow up required at ${formattedDate}`,
    entity_type: 'contact_activity',
    entity_id: activity.id,
    action_url: `/contacts/${activity.contact_id}`,
    metadata: {
      activity_type: activity.activity_type,
      subject: activity.subject,
      next_action_date: activity.next_action_date,
      reminder_type: type,
    },
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  
  const { error: insertError } = await supabase
    .from('notifications')
    .insert(notification);
  
  if (insertError) {
    console.error(`[NextActions] Failed to create ${type} notification for activity ${activity.id}:`, insertError);
    return;
  }
  
  // Mark as reminded
  const updateField = type === 'morning' ? 'morning_reminder_sent' : 'pre_action_reminder_sent';
  const { error: updateError } = await supabase
    .from('contact_activities')
    .update({ [updateField]: true })
    .eq('id', activity.id);
  
  if (updateError) {
    console.error(`[NextActions] Failed to mark activity ${activity.id} as reminded:`, updateError);
  } else {
    console.log(`[NextActions] Created ${type} notification for activity ${activity.id}`);
  }
}
