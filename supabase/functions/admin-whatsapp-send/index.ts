import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// ADMIN WHATSAPP SEND - Meta Cloud API (Primary) + Twilio (Fallback)
// ============================================================
// Sends WhatsApp messages via Meta Cloud API or Twilio
// Supports both free-form text (within 24h window) and templates
// Default provider: Meta (WHATSAPP_MODE=meta)
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhoneForMeta(phone: string): string {
  // Meta expects phone without + prefix
  return phone.replace(/[^0-9]/g, "");
}

function normalizePhoneE164(phone: string): string {
  let normalized = phone.replace(/[^0-9]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Provider configuration - default to meta (production)
  // Production number: +54 9 11 2679 9335
  const whatsappMode = Deno.env.get('WHATSAPP_MODE') || 'meta'; // meta | twilio | stub
  
  // Meta WhatsApp API credentials
  const metaAccessToken = Deno.env.get('META_WA_ACCESS_TOKEN');
  const metaPhoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID');
  const metaConfigured = !!(metaAccessToken && metaPhoneNumberId);
  
  // Twilio credentials (fallback)
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuth = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioWhatsappFrom = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
  const twilioConfigured = !!(twilioSid && twilioAuth && twilioWhatsappFrom);

  console.log('[admin-whatsapp-send] Config:', {
    whatsappMode,
    metaConfigured,
    twilioConfigured,
  });

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
    const { conversation_id, to, body: messageBody, template_name, template_params } = await req.json();

    if (!to || (!messageBody && !template_name)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing required fields: to and (body or template_name)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneE164 = normalizePhoneE164(to);
    const phoneForMeta = normalizePhoneForMeta(to);

    // Create service role client for DB operations
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Find or create conversation
    let convId = conversation_id;
    if (!convId) {
      const { data: existingConv } = await adminSupabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('customer_phone_e164', phoneE164)
        .maybeSingle();

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await adminSupabase
          .from('whatsapp_conversations')
          .insert({
            customer_phone_e164: phoneE164,
            last_message_preview: (messageBody || `[Template: ${template_name}]`).substring(0, 100),
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
    const displayBody = messageBody || `[Template: ${template_name}]`;
    const { data: messageData, error: msgError } = await adminSupabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: convId,
        direction: 'outbound',
        body: displayBody,
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

    let stub = false;
    let externalMessageId: string | null = null;
    let sendError: string | null = null;
    let finalStatus = 'sent';
    let provider = 'none';

    // ============================================================
    // TRY META CLOUD API FIRST (if mode is meta or auto)
    // ============================================================
    if ((whatsappMode === 'meta' || !twilioConfigured) && metaConfigured) {
      provider = 'meta';
      try {
        let metaPayload: any;

        if (template_name) {
          // Send template message
          metaPayload = {
            messaging_product: 'whatsapp',
            to: phoneForMeta,
            type: 'template',
            template: {
              name: template_name,
              language: { code: 'es_AR' },
              components: template_params || [],
            },
          };
        } else {
          // Send text message
          metaPayload = {
            messaging_product: 'whatsapp',
            to: phoneForMeta,
            type: 'text',
            text: {
              body: messageBody,
            },
          };
        }

        console.log('[admin-whatsapp-send] Sending via Meta API to:', phoneForMeta);

        const metaResponse = await fetch(
          `https://graph.facebook.com/v20.0/${metaPhoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(metaPayload),
          }
        );

        const metaResult = await metaResponse.json();
        console.log('[admin-whatsapp-send] Meta response:', metaResponse.status);

        if (metaResponse.ok && metaResult.messages?.[0]?.id) {
          externalMessageId = metaResult.messages[0].id;
          finalStatus = 'sent';
          stub = false;
          console.log('[admin-whatsapp-send] Meta success:', externalMessageId);
        } else {
          const errorMsg = metaResult.error?.message || 'Meta API error';
          const errorCode = metaResult.error?.code || metaResponse.status;
          sendError = `META_${errorCode}: ${errorMsg}`;
          finalStatus = 'failed';
          console.error('[admin-whatsapp-send] Meta error:', metaResult);
        }
      } catch (err: any) {
        sendError = `META_ERROR: ${err.message}`;
        finalStatus = 'failed';
        console.error('[admin-whatsapp-send] Meta exception:', err);
      }
    }
    // ============================================================
    // FALLBACK TO TWILIO (if Meta failed or mode is twilio)
    // ============================================================
    else if ((whatsappMode === 'twilio' || !metaConfigured) && twilioConfigured) {
      provider = 'twilio';
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        
        const whatsappTo = phoneE164.startsWith('whatsapp:') ? phoneE164 : `whatsapp:${phoneE164}`;
        const whatsappFrom = twilioWhatsappFrom!.startsWith('whatsapp:') ? twilioWhatsappFrom : `whatsapp:${twilioWhatsappFrom}`;
        
        const formData = new URLSearchParams();
        formData.append('To', whatsappTo);
        formData.append('From', whatsappFrom!);
        formData.append('Body', displayBody);

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
          externalMessageId = twilioData.sid;
          finalStatus = 'sent';
          stub = false;
          console.log('[admin-whatsapp-send] Twilio success:', externalMessageId);
        } else {
          sendError = `TWILIO: ${twilioData.message || 'Send failed'}`;
          finalStatus = 'failed';
          console.error('[admin-whatsapp-send] Twilio error:', twilioData);
        }
      } catch (err: any) {
        sendError = `TWILIO_ERROR: ${err.message}`;
        finalStatus = 'failed';
        console.error('[admin-whatsapp-send] Twilio exception:', err);
      }
    }
    // ============================================================
    // NO PROVIDER CONFIGURED - STUB MODE
    // ============================================================
    else {
      provider = 'stub';
      stub = true;
      sendError = 'NO_PROVIDER_CONFIGURED';
      finalStatus = 'sent'; // Mark as sent for UI purposes
      console.log('[admin-whatsapp-send] Stub mode - no provider configured');
    }

    // Update message with final status
    await adminSupabase
      .from('whatsapp_messages')
      .update({
        status: finalStatus,
        twilio_message_sid: externalMessageId,
        error: sendError,
      })
      .eq('id', messageData.id);

    // Update conversation with last message info
    await adminSupabase
      .from('whatsapp_conversations')
      .update({
        last_message_preview: displayBody.substring(0, 100),
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
        ok: finalStatus !== 'failed',
        message: updatedMessage,
        stub,
        provider,
        conversation_id: convId,
        wa_message_id: externalMessageId,
        error: finalStatus === 'failed' ? sendError : undefined,
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
