import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[admin-whatsapp-send] Auth error:', userError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('[admin-whatsapp-send] Not admin:', roleError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { conversation_id, to, body: messageBody } = await req.json();

    if (!to || !messageBody) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing required fields: to, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone to E.164
    let phoneE164 = to.replace(/\s+/g, '');
    if (!phoneE164.startsWith('+')) {
      phoneE164 = '+' + phoneE164;
    }

    // Create service role client for DB operations
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Find or create conversation
    let convId = conversation_id;
    if (!convId) {
      // Try to find existing conversation
      const { data: existingConv } = await adminSupabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('customer_phone_e164', phoneE164)
        .maybeSingle();

      if (existingConv) {
        convId = existingConv.id;
      } else {
        // Create new conversation
        const { data: newConv, error: convError } = await adminSupabase
          .from('whatsapp_conversations')
          .insert({
            customer_phone_e164: phoneE164,
            last_message_preview: messageBody.substring(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (convError) {
          console.error('[admin-whatsapp-send] Error creating conversation:', convError);
          return new Response(
            JSON.stringify({ ok: false, error: 'Failed to create conversation' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        convId = newConv.id;
      }
    }

    // Insert message with status 'queued'
    const { data: messageData, error: msgError } = await adminSupabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: convId,
        direction: 'outbound',
        body: messageBody,
        status: 'queued',
        created_by: user.id,
      })
      .select()
      .single();

    if (msgError) {
      console.error('[admin-whatsapp-send] Error inserting message:', msgError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to save message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if Twilio is configured
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuth = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsappFrom = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    let stub = true;
    let twilioMessageSid: string | null = null;
    let sendError: string | null = null;
    let finalStatus = 'sent';

    if (twilioSid && twilioAuth && twilioWhatsappFrom) {
      // Twilio is configured - try to send
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        
        // Format numbers for WhatsApp
        const whatsappTo = phoneE164.startsWith('whatsapp:') ? phoneE164 : `whatsapp:${phoneE164}`;
        const whatsappFrom = twilioWhatsappFrom.startsWith('whatsapp:') ? twilioWhatsappFrom : `whatsapp:${twilioWhatsappFrom}`;
        
        const formData = new URLSearchParams();
        formData.append('To', whatsappTo);
        formData.append('From', whatsappFrom);
        formData.append('Body', messageBody);

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioAuth}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        const twilioData = await twilioResponse.json();

        if (twilioResponse.ok && twilioData.sid) {
          twilioMessageSid = twilioData.sid;
          finalStatus = 'sent';
          stub = false;
          console.log('[admin-whatsapp-send] Message sent via Twilio:', twilioMessageSid);
        } else {
          sendError = twilioData.message || 'Twilio send failed';
          finalStatus = 'failed';
          console.error('[admin-whatsapp-send] Twilio error:', twilioData);
        }
      } catch (err: any) {
        sendError = err.message || 'Twilio request failed';
        finalStatus = 'failed';
        console.error('[admin-whatsapp-send] Twilio exception:', err);
      }
    } else {
      // Stub mode - Twilio not configured
      sendError = 'TWILIO_NOT_CONFIGURED_STUB';
      finalStatus = 'sent';
      console.log('[admin-whatsapp-send] Stub mode - Twilio not configured');
    }

    // Update message with final status
    await adminSupabase
      .from('whatsapp_messages')
      .update({
        status: finalStatus,
        twilio_message_sid: twilioMessageSid,
        error: sendError,
      })
      .eq('id', messageData.id);

    // Update conversation with last message info
    await adminSupabase
      .from('whatsapp_conversations')
      .update({
        last_message_preview: messageBody.substring(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', convId);

    // Fetch updated message
    const { data: updatedMessage } = await adminSupabase
      .from('whatsapp_messages')
      .select('*')
      .eq('id', messageData.id)
      .single();

    return new Response(
      JSON.stringify({
        ok: true,
        message: updatedMessage,
        stub,
        conversation_id: convId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[admin-whatsapp-send] Unexpected error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
