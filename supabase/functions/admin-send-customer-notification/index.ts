import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// ADMIN SEND CUSTOMER NOTIFICATION - Meta Cloud API (Primary)
// ============================================================
// Sends customer notifications via Meta WhatsApp Cloud API
// Twilio is available as fallback only if META is not configured
// Default: Meta Cloud API
// Production number: +54 9 11 2679 9335
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  booking_id: string;
  type: 'ON_MY_WAY' | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED';
}

function normalizePhoneForMeta(phone: string): string {
  // Meta expects phone without + prefix, just digits
  return phone.replace(/[^0-9]/g, "");
}

function normalizePhoneE164(phone: string): string {
  let normalized = phone.replace(/[^0-9]/g, "");
  // Handle Argentina mobile numbers
  if (normalized.startsWith("15")) {
    // Buenos Aires mobile without area code
    normalized = "5411" + normalized.substring(2);
  } else if (normalized.length === 10 && !normalized.startsWith("54")) {
    // Assume Argentina
    normalized = "54" + normalized;
  } else if (!normalized.startsWith("54") && normalized.length < 13) {
    normalized = "54" + normalized;
  }
  return "+" + normalized;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Meta WhatsApp API credentials (PRIMARY)
    const metaAccessToken = Deno.env.get('META_WA_ACCESS_TOKEN');
    const metaPhoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID');
    const metaConfigured = !!(metaAccessToken && metaPhoneNumberId);

    // Twilio credentials (FALLBACK ONLY)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    const twilioConfigured = !!(twilioAccountSid && twilioAuthToken && twilioWhatsAppNumber);

    // Provider mode - default to meta
    const whatsappMode = Deno.env.get('WHATSAPP_MODE') || 'meta';

    console.log('[admin-send-customer-notification] Config:', {
      metaConfigured,
      twilioConfigured,
      whatsappMode,
    });

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('[admin-send-customer-notification] Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { booking_id, type } = await req.json() as NotificationRequest;

    if (!booking_id || !type) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: booking_id and type required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, customer_name, customer_phone, customer_email, address, booking_date, booking_time, service_name')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('[admin-send-customer-notification] Booking fetch error:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build message based on type
    const firstName = booking.customer_name?.split(' ')[0] || '';
    const greeting = firstName ? `Hola ${firstName}!` : 'Hola!';
    const address = booking.address || 'tu ubicación';
    
    // Format date in Spanish
    const dateObj = new Date(booking.booking_date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });

    let message = '';
    let templateName = '';
    
    switch (type) {
      case 'ON_MY_WAY':
        message = `${greeting} Soy Washero 🚐. Estamos en camino hacia ${address}. Tu turno es ${dateFormatted} ${booking.booking_time}. Si necesitás reprogramar, respondé este mensaje.`;
        templateName = 'washero_on_the_way';
        break;
      case 'BOOKING_CONFIRMED':
        message = `${greeting} Tu reserva con Washero está confirmada para ${dateFormatted} ${booking.booking_time} en ${address}. ¡Te esperamos!`;
        templateName = 'washero_booking_confirmed';
        break;
      case 'BOOKING_CANCELLED':
        message = `${greeting} Tu reserva con Washero para ${dateFormatted} ha sido cancelada. Si querés reagendar, visitá washero.online`;
        templateName = 'washero_booking_cancelled';
        break;
      default:
        message = `${greeting} Mensaje de Washero sobre tu reserva.`;
    }

    const phoneE164 = normalizePhoneE164(booking.customer_phone);
    const phoneForMeta = normalizePhoneForMeta(phoneE164);

    let channel = 'pending';
    let providerMessageId: string | null = null;
    let sendError: string | null = null;
    let provider = 'none';

    // ============================================================
    // TRY META CLOUD API FIRST (PRIMARY)
    // ============================================================
    if (metaConfigured && (whatsappMode === 'meta' || whatsappMode === 'production')) {
      provider = 'meta';
      try {
        // Send free-form text message (within 24h window should work)
        const metaPayload = {
          messaging_product: 'whatsapp',
          to: phoneForMeta,
          type: 'text',
          text: {
            body: message,
          },
        };

        console.log('[admin-send-customer-notification] Sending via Meta to:', phoneForMeta);

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
        console.log('[admin-send-customer-notification] Meta response:', metaResponse.status, JSON.stringify(metaResult));

        if (metaResponse.ok && metaResult.messages?.[0]?.id) {
          providerMessageId = metaResult.messages[0].id;
          channel = 'whatsapp';
          console.log('[admin-send-customer-notification] Meta success:', providerMessageId);
        } else {
          const errorMsg = metaResult.error?.message || 'Meta API error';
          const errorCode = metaResult.error?.code || metaResponse.status;
          sendError = `META_${errorCode}: ${errorMsg}`;
          console.error('[admin-send-customer-notification] Meta error:', metaResult);
          
          // If outside 24h window, try template
          if (errorCode === 131026 || errorMsg.includes('24 hours')) {
            console.log('[admin-send-customer-notification] Outside 24h window, trying template...');
            
            const templatePayload = {
              messaging_product: 'whatsapp',
              to: phoneForMeta,
              type: 'template',
              template: {
                name: templateName,
                language: { code: 'es_AR' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: firstName || 'Cliente' },
                      { type: 'text', text: dateFormatted },
                      { type: 'text', text: booking.booking_time },
                      { type: 'text', text: address },
                    ],
                  },
                ],
              },
            };

            const templateResponse = await fetch(
              `https://graph.facebook.com/v20.0/${metaPhoneNumberId}/messages`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${metaAccessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(templatePayload),
              }
            );

            const templateResult = await templateResponse.json();
            
            if (templateResponse.ok && templateResult.messages?.[0]?.id) {
              providerMessageId = templateResult.messages[0].id;
              channel = 'whatsapp';
              sendError = null;
              console.log('[admin-send-customer-notification] Template success:', providerMessageId);
            } else {
              sendError = `META_TEMPLATE: ${templateResult.error?.message || 'Template failed'}`;
              console.error('[admin-send-customer-notification] Template error:', templateResult);
            }
          }
        }
      } catch (err: any) {
        sendError = `META_ERROR: ${err.message}`;
        console.error('[admin-send-customer-notification] Meta exception:', err);
      }
    }
    // ============================================================
    // FALLBACK TO TWILIO (only if Meta not configured)
    // ============================================================
    else if (twilioConfigured && whatsappMode === 'twilio') {
      provider = 'twilio';
      try {
        const toNumber = `whatsapp:${phoneE164}`;
        const fromNumber = twilioWhatsAppNumber!.startsWith('whatsapp:') 
          ? twilioWhatsAppNumber 
          : `whatsapp:${twilioWhatsAppNumber}`;

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: toNumber,
            From: fromNumber!,
            Body: message,
          }),
        });

        const twilioResult = await twilioResponse.json();
        
        if (twilioResponse.ok && twilioResult.sid) {
          channel = 'whatsapp';
          providerMessageId = twilioResult.sid;
          console.log('[admin-send-customer-notification] Twilio success:', providerMessageId);
        } else {
          console.error('[admin-send-customer-notification] Twilio error:', twilioResult);
          sendError = twilioResult.message || 'Failed to send WhatsApp';
        }
      } catch (twilioError: any) {
        console.error('[admin-send-customer-notification] Twilio exception:', twilioError);
        sendError = String(twilioError);
      }
    } else {
      console.log('[admin-send-customer-notification] No WhatsApp provider configured, storing message');
      provider = 'stub';
    }

    // Store in outgoing_messages table
    const { data: insertedMessage, error: insertError } = await supabaseClient
      .from('outgoing_messages')
      .insert({
        booking_id: booking.id,
        customer_phone: booking.customer_phone,
        type,
        channel: channel === 'whatsapp' ? 'whatsapp' : 'pending',
        message,
        status: channel === 'whatsapp' ? 'sent' : 'queued',
        provider_message_id: providerMessageId,
        error: sendError,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[admin-send-customer-notification] Failed to store message:', insertError);
    }

    // Also store in whatsapp_messages for conversation history
    if (channel === 'whatsapp') {
      // Find or create conversation
      const { data: existingConv } = await supabaseClient
        .from('whatsapp_conversations')
        .select('id')
        .eq('customer_phone_e164', phoneE164)
        .maybeSingle();

      let convId = existingConv?.id;
      
      if (!convId) {
        const { data: newConv } = await supabaseClient
          .from('whatsapp_conversations')
          .insert({
            customer_phone_e164: phoneE164,
            customer_name: booking.customer_name,
            last_message_preview: message.substring(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        convId = newConv?.id;
      }

      if (convId) {
        await supabaseClient
          .from('whatsapp_messages')
          .insert({
            conversation_id: convId,
            direction: 'outbound',
            body: message,
            status: 'sent',
            twilio_message_sid: providerMessageId,
            created_by: user.id,
          });

        // Update conversation
        await supabaseClient
          .from('whatsapp_conversations')
          .update({
            last_message_preview: message.substring(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .eq('id', convId);
      }
    }

    console.log('[admin-send-customer-notification] Processed:', {
      booking_id,
      type,
      channel,
      provider,
      sent: channel === 'whatsapp',
    });

    return new Response(
      JSON.stringify({
        ok: channel === 'whatsapp' || provider === 'stub',
        channel,
        provider,
        message,
        stored: !!insertedMessage,
        sent: channel === 'whatsapp',
        wa_message_id: providerMessageId,
        error: sendError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-send-customer-notification] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
