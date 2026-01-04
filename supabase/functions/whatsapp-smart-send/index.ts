import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// WHATSAPP SMART SEND - Auto-selects template vs free text
// ============================================================
// Logic:
// 1. Check if customer is within 24h session window (last_inbound_at)
// 2. If within window: send free text OR template (either works)
// 3. If outside window: MUST send approved template
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template definitions with their Meta template names and expected parameters
const TEMPLATE_CONFIG: Record<string, { metaName: string; paramCount: number; defaultText: string }> = {
  on_the_way: {
    metaName: 'washero_on_the_way',
    paramCount: 2,
    defaultText: 'Hola {{1}}! Somos Washero 🚐 Estamos en camino hacia tu ubicación. ¡Llegamos pronto! ¿Tenés alguna consulta?',
  },
  arriving_10_min: {
    metaName: 'washero_arriving_10_min',
    paramCount: 2,
    defaultText: 'Hola {{1}}! Te avisamos que estamos a 10 minutos de llegar. ¡Preparate!',
  },
  arrived: {
    metaName: 'washero_arrived',
    paramCount: 1,
    defaultText: 'Hola {{1}}! Ya llegamos a tu ubicación. ¿Dónde podemos estacionar?',
  },
  reschedule: {
    metaName: 'washero_reschedule_request',
    paramCount: 1,
    defaultText: 'Hola {{1}}! Lamentamos informarte que necesitamos reprogramar tu turno. ¿Qué horario te queda mejor?',
  },
  booking_confirmed: {
    metaName: 'washero_booking_confirmed',
    paramCount: 3,
    defaultText: 'Hola {{1}}! Tu turno de lavado está confirmado para el {{2}} a las {{3}}. ¿Tenés alguna consulta?',
  },
  payment_instructions: {
    metaName: 'washero_payment_instructions',
    paramCount: 2,
    defaultText: 'Hola {{1}}! Para completar tu reserva, realizá el pago en: {{2}}',
  },
};

function normalizePhoneForMeta(phone: string): string {
  return normalizePhoneE164(phone).replace(/[^0-9]/g, "");
}

function normalizePhoneE164(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) cleaned = cleaned.substring(1);
  
  if (cleaned.startsWith('549') && cleaned.length >= 12) return '+' + cleaned;
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    const rest = cleaned.substring(2);
    if (rest.startsWith('11') || rest.startsWith('15') || rest.length === 10) {
      let mobile = rest;
      if (mobile.startsWith('15')) mobile = mobile.substring(2);
      return '+549' + mobile;
    }
    return '+54' + rest;
  }
  if (cleaned.startsWith('15') && cleaned.length >= 8) return '+54911' + cleaned.substring(2);
  if (cleaned.startsWith('11') && cleaned.length >= 10) return '+549' + cleaned;
  if (cleaned.startsWith('9') && cleaned.length >= 10) return '+54' + cleaned;
  if (cleaned.length === 10) return '+549' + cleaned;
  if (cleaned.length === 8) return '+54911' + cleaned;
  if (cleaned.length >= 8 && cleaned.length <= 12 && !cleaned.startsWith('54')) return '+54' + cleaned;
  return '+' + cleaned;
}

function isWithin24hWindow(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  const diff = Date.now() - new Date(lastInboundAt).getTime();
  const hours24 = 24 * 60 * 60 * 1000;
  return diff < hours24;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const metaAccessToken = Deno.env.get('META_WA_ACCESS_TOKEN');
  const metaPhoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID');
  const whatsappMode = Deno.env.get('WHATSAPP_MODE') || 'meta';

  console.log('[whatsapp-smart-send] Config:', {
    metaConfigured: !!(metaAccessToken && metaPhoneNumberId),
    whatsappMode,
  });

  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { 
      to, 
      action, // 'on_the_way' | 'arriving_10_min' | 'arrived' | 'reschedule' | 'booking_confirmed' | 'payment_instructions' | 'custom'
      custom_text,
      customer_name,
      booking_date,
      booking_time,
      payment_link,
      conversation_id,
    } = await req.json();

    if (!to || !action) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing required fields: to and action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneE164 = normalizePhoneE164(to);
    const phoneForMeta = normalizePhoneForMeta(to);

    console.log('[whatsapp-smart-send] Request:', {
      phoneE164,
      action,
      hasCustomText: !!custom_text,
      customerName: customer_name,
    });

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Get or create conversation
    let convId = conversation_id;
    let lastInboundAt: string | null = null;
    
    const { data: existingConv } = await adminSupabase
      .from('whatsapp_conversations')
      .select('id, last_inbound_at, customer_name')
      .eq('customer_phone_e164', phoneE164)
      .maybeSingle();

    if (existingConv) {
      convId = existingConv.id;
      lastInboundAt = existingConv.last_inbound_at;
    } else {
      const { data: newConv } = await adminSupabase
        .from('whatsapp_conversations')
        .insert({
          customer_phone_e164: phoneE164,
          customer_name: customer_name || 'Cliente',
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      convId = newConv?.id;
    }

    const within24h = isWithin24hWindow(lastInboundAt);
    console.log('[whatsapp-smart-send] 24h window check:', {
      lastInboundAt,
      within24h,
    });

    // Determine message type and content
    let useTemplate = !within24h;
    let templateName: string | null = null;
    let templateParams: any[] = [];
    let messageBody = '';
    
    const templateConfig = TEMPLATE_CONFIG[action];
    const displayName = customer_name || existingConv?.customer_name || 'Cliente';

    if (action === 'custom') {
      // Custom text - only works within 24h window
      if (!within24h) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: 'Fuera de ventana 24h. El cliente debe responder primero para enviar texto libre.',
            requires_template: true,
            within_24h: false,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      messageBody = custom_text;
      useTemplate = false;
    } else if (templateConfig) {
      templateName = templateConfig.metaName;
      
      // Build template params based on action
      switch (action) {
        case 'on_the_way':
        case 'arriving_10_min':
          templateParams = [
            { type: 'text', text: displayName },
            { type: 'text', text: 'Washero' },
          ];
          break;
        case 'arrived':
        case 'reschedule':
          templateParams = [{ type: 'text', text: displayName }];
          break;
        case 'booking_confirmed':
          templateParams = [
            { type: 'text', text: displayName },
            { type: 'text', text: booking_date || 'fecha pendiente' },
            { type: 'text', text: booking_time || 'hora pendiente' },
          ];
          break;
        case 'payment_instructions':
          templateParams = [
            { type: 'text', text: displayName },
            { type: 'text', text: payment_link || 'https://washero.ar/pagar' },
          ];
          break;
      }

      // Generate fallback text (for display and within-24h sends)
      messageBody = templateConfig.defaultText
        .replace('{{1}}', displayName)
        .replace('{{2}}', booking_date || payment_link || 'Washero')
        .replace('{{3}}', booking_time || '');

      // If within 24h, we can send free text (simpler)
      useTemplate = !within24h;
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert message record
    const displayText = useTemplate ? `[Template: ${templateName}] ${messageBody}` : messageBody;
    const { data: messageData, error: msgError } = await adminSupabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: convId,
        direction: 'outbound',
        body: displayText,
        status: 'queued',
        created_by: user.id,
      })
      .select()
      .single();

    if (msgError) {
      console.error('[whatsapp-smart-send] Error inserting message:', msgError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to save message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via Meta API
    let externalMessageId: string | null = null;
    let sendError: string | null = null;
    let finalStatus = 'sent';

    if (metaAccessToken && metaPhoneNumberId && whatsappMode === 'meta') {
      try {
        let metaPayload: any;

        if (useTemplate && templateName) {
          // Send template message (required outside 24h window)
          metaPayload = {
            messaging_product: 'whatsapp',
            to: phoneForMeta,
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'es_AR' },
              components: templateParams.length > 0 ? [{
                type: 'body',
                parameters: templateParams,
              }] : [],
            },
          };
          console.log('[whatsapp-smart-send] Sending TEMPLATE:', templateName);
        } else {
          // Send text message (within 24h window)
          metaPayload = {
            messaging_product: 'whatsapp',
            to: phoneForMeta,
            type: 'text',
            text: { body: messageBody },
          };
          console.log('[whatsapp-smart-send] Sending FREE TEXT (within 24h window)');
        }

        console.log('[whatsapp-smart-send] Meta payload:', JSON.stringify(metaPayload));

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
        console.log('[whatsapp-smart-send] Meta response:', {
          status: metaResponse.status,
          ok: metaResponse.ok,
          hasMessageId: !!metaResult.messages?.[0]?.id,
          error: metaResult.error,
        });

        if (metaResponse.ok && metaResult.messages?.[0]?.id) {
          externalMessageId = metaResult.messages[0].id;
          finalStatus = 'sent';
          console.log('[whatsapp-smart-send] SUCCESS:', externalMessageId);
        } else {
          const errorMsg = metaResult.error?.message || 'Meta API error';
          const errorCode = metaResult.error?.code || metaResponse.status;
          sendError = `META_${errorCode}: ${errorMsg}`;
          finalStatus = 'failed';
          console.error('[whatsapp-smart-send] FAILED:', metaResult);
        }
      } catch (err: any) {
        sendError = `META_ERROR: ${err.message}`;
        finalStatus = 'failed';
        console.error('[whatsapp-smart-send] Exception:', err);
      }
    } else {
      sendError = 'Meta WhatsApp not configured';
      finalStatus = 'failed';
      console.warn('[whatsapp-smart-send] Meta not configured');
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

    // Update conversation
    await adminSupabase
      .from('whatsapp_conversations')
      .update({
        last_message_preview: messageBody.substring(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', convId);

    const { data: updatedMessage } = await adminSupabase
      .from('whatsapp_messages')
      .select('*')
      .eq('id', messageData.id)
      .single();

    return new Response(
      JSON.stringify({
        ok: finalStatus !== 'failed',
        message: updatedMessage,
        used_template: useTemplate,
        template_name: templateName,
        within_24h: within24h,
        wa_message_id: externalMessageId,
        error: finalStatus === 'failed' ? sendError : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[whatsapp-smart-send] Unexpected error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});