import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Optional: Verify webhook secret
    const webhookSecret = Deno.env.get('TWILIO_WEBHOOK_SECRET');
    if (webhookSecret) {
      const providedSecret = req.headers.get('x-webhook-secret');
      if (providedSecret !== webhookSecret) {
        console.warn('[twilio-whatsapp-webhook] Invalid webhook secret');
        // Still return 200 to prevent Twilio retries, but log warning
      }
    }

    // Parse form data from Twilio
    const formData = await req.formData();
    const data: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value.toString();
    }

    console.log('[twilio-whatsapp-webhook] Received:', JSON.stringify(data, null, 2));

    const messageSid = data.MessageSid || data.SmsSid;
    const messageStatus = data.MessageStatus || data.SmsStatus;
    const from = data.From || '';
    const to = data.To || '';
    const body = data.Body || '';

    // Normalize phone number (remove whatsapp: prefix)
    const normalizePhone = (phone: string): string => {
      return phone.replace('whatsapp:', '').trim();
    };

    // Check if this is a status callback (has MessageStatus but no Body)
    if (messageStatus && !body && messageSid) {
      console.log('[twilio-whatsapp-webhook] Status callback for:', messageSid, '->', messageStatus);
      
      // Find and update message by twilio_message_sid
      const { data: existingMsg, error: findError } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('twilio_message_sid', messageSid)
        .maybeSingle();

      if (existingMsg) {
        // Map Twilio status to our status
        let ourStatus = messageStatus.toLowerCase();
        if (!['queued', 'sent', 'delivered', 'read', 'failed'].includes(ourStatus)) {
          ourStatus = 'sent'; // Default fallback
        }

        await supabase
          .from('whatsapp_messages')
          .update({ status: ourStatus })
          .eq('id', existingMsg.id);

        console.log('[twilio-whatsapp-webhook] Updated message status:', existingMsg.id, '->', ourStatus);
      } else {
        console.log('[twilio-whatsapp-webhook] Message not found for SID:', messageSid);
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // This is an inbound message
    if (body && from) {
      const customerPhone = normalizePhone(from);
      console.log('[twilio-whatsapp-webhook] Inbound message from:', customerPhone);

      // Find or create conversation
      let conversationId: string;
      const { data: existingConv } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('customer_phone_e164', customerPhone)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        // Create new conversation
        const { data: newConv, error: convError } = await supabase
          .from('whatsapp_conversations')
          .insert({
            customer_phone_e164: customerPhone,
            last_message_preview: body.substring(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (convError) {
          console.error('[twilio-whatsapp-webhook] Error creating conversation:', convError);
          return new Response('Error', { status: 500, headers: corsHeaders });
        }
        conversationId = newConv.id;
      }

      // Insert inbound message
      const { error: msgError } = await supabase
        .from('whatsapp_messages')
        .insert({
          conversation_id: conversationId,
          direction: 'inbound',
          body: body,
          status: 'received',
          twilio_message_sid: messageSid || null,
        });

      if (msgError) {
        console.error('[twilio-whatsapp-webhook] Error inserting message:', msgError);
      }

      // Update conversation
      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message_preview: body.substring(0, 100),
          last_message_at: new Date().toISOString(),
          is_open: true,
        })
        .eq('id', conversationId);

      console.log('[twilio-whatsapp-webhook] Saved inbound message to conversation:', conversationId);
    }

    // Always return 200 to Twilio
    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error('[twilio-whatsapp-webhook] Unexpected error:', error);
    // Still return 200 to prevent Twilio retries
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
