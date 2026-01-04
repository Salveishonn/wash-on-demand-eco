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
  // Meta expects phone without + prefix, just digits
  const e164 = normalizePhoneE164(phone);
  return e164.replace(/[^0-9]/g, "");
}

function normalizePhoneE164(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + for processing
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle Argentina-specific formats
  
  // Already has full Argentina code with 9 (mobile indicator)
  if (cleaned.startsWith('549') && cleaned.length >= 12) {
    return '+' + cleaned;
  }
  
  // Has Argentina code without mobile 9
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    const rest = cleaned.substring(2);
    // Check if it's a mobile number (needs 9)
    if (rest.startsWith('11') || rest.startsWith('15') || rest.length === 10) {
      // Add mobile indicator 9
      let mobile = rest;
      if (mobile.startsWith('15')) {
        // Remove local mobile prefix and add 9
        mobile = mobile.substring(2);
      }
      return '+549' + mobile;
    }
    return '+54' + rest;
  }
  
  // Starts with 15 (local mobile prefix in Argentina)
  if (cleaned.startsWith('15') && cleaned.length >= 8) {
    // Remove 15 and add full prefix (assume Buenos Aires 11)
    const number = cleaned.substring(2);
    return '+54911' + number;
  }
  
  // Starts with 11 (Buenos Aires area code)
  if (cleaned.startsWith('11') && cleaned.length >= 10) {
    return '+549' + cleaned;
  }
  
  // Starts with 9 (mobile indicator without country code)
  if (cleaned.startsWith('9') && cleaned.length >= 10) {
    return '+54' + cleaned;
  }
  
  // 10-digit number (area code + number)
  if (cleaned.length === 10) {
    return '+549' + cleaned;
  }
  
  // 8-digit number (Buenos Aires local without area code)
  if (cleaned.length === 8) {
    return '+54911' + cleaned;
  }
  
  // Fallback: add +54 if it looks like an Argentina number
  if (cleaned.length >= 8 && cleaned.length <= 12 && !cleaned.startsWith('54')) {
    return '+54' + cleaned;
  }
  
  // Return as-is with + if it's already formatted
  return '+' + cleaned;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Provider configuration - Meta is the primary provider
  const whatsappMode = Deno.env.get('WHATSAPP_MODE') || 'meta';
  
  // Meta WhatsApp API credentials
  const metaAccessToken = Deno.env.get('META_WA_ACCESS_TOKEN');
  const metaPhoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID');
  const metaConfigured = !!(metaAccessToken && metaPhoneNumberId);
  
  // Twilio credentials (fallback only)
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuth = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioWhatsappFrom = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
  const twilioConfigured = !!(twilioSid && twilioAuth && twilioWhatsappFrom);

  console.log('[admin-whatsapp-send] Config:', {
    whatsappMode,
    metaConfigured,
    metaPhoneNumberId: metaPhoneNumberId ? `${metaPhoneNumberId.substring(0, 8)}...` : 'NOT SET',
    metaAccessToken: metaAccessToken ? 'SET (hidden)' : 'NOT SET',
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
    // SEND VIA META CLOUD API (primary provider)
    // ============================================================
    if (metaConfigured) {
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
          console.log('[admin-whatsapp-send] Sending template:', template_name, 'to:', phoneForMeta);
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
          console.log('[admin-whatsapp-send] Sending text to:', phoneForMeta);
        }

        console.log('[admin-whatsapp-send] Meta API call:', {
          url: `https://graph.facebook.com/v20.0/${metaPhoneNumberId}/messages`,
          type: metaPayload.type,
          template: metaPayload.template?.name,
        });

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
        console.log('[admin-whatsapp-send] Meta response:', {
          status: metaResponse.status,
          ok: metaResponse.ok,
          messageId: metaResult.messages?.[0]?.id,
          error: metaResult.error,
        });

        if (metaResponse.ok && metaResult.messages?.[0]?.id) {
          externalMessageId = metaResult.messages[0].id;
          finalStatus = 'sent';
          stub = false;
          console.log('[admin-whatsapp-send] SUCCESS - Message ID:', externalMessageId);
        } else {
          const errorMsg = metaResult.error?.message || 'Meta API error';
          const errorCode = metaResult.error?.code || metaResponse.status;
          sendError = `META_${errorCode}: ${errorMsg}`;
          finalStatus = 'failed';
          console.error('[admin-whatsapp-send] FAILED:', JSON.stringify(metaResult));
        }
      } catch (err: any) {
        sendError = `META_ERROR: ${err.message}`;
        finalStatus = 'failed';
        console.error('[admin-whatsapp-send] Exception:', err.message);
      }
    }
    // ============================================================
    // FALLBACK TO TWILIO (only if Meta is not configured)
    // ============================================================
    else if (twilioConfigured && whatsappMode === 'twilio') {
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
        console.error('[admin-whatsapp-send] Twilio exception:', err.message);
      }
    }
    // ============================================================
    // NO PROVIDER CONFIGURED
    // ============================================================
    else {
      provider = 'none';
      stub = true;
      
      const missing = [];
      if (!metaAccessToken) missing.push('META_WA_ACCESS_TOKEN');
      if (!metaPhoneNumberId) missing.push('META_WA_PHONE_NUMBER_ID');
      
      sendError = `NO_PROVIDER_CONFIGURED: Missing ${missing.join(', ')}`;
      finalStatus = 'failed';
      console.error('[admin-whatsapp-send] No provider configured. Missing:', missing);
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
