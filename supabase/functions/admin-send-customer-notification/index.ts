import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// ADMIN SEND CUSTOMER NOTIFICATION - Meta Cloud API (Primary)
// ============================================================
// Fixed: Phone normalization, template params, email fallback
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  booking_id: string;
  type: 'ON_MY_WAY' | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED';
}

// =============================================================
// PHONE NORMALIZATION - Inline for Edge Function compatibility
// =============================================================
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

function normalizePhoneForMeta(phone: string): string {
  return normalizePhoneE164(phone).replace(/[^0-9]/g, '');
}

function validatePhone(phone: string): { valid: boolean; error?: string; forMeta: string } {
  const forMeta = normalizePhoneForMeta(phone);
  if (forMeta.length < 10) return { valid: false, error: `Too short: ${forMeta.length} digits`, forMeta };
  if (forMeta.length > 15) return { valid: false, error: `Too long: ${forMeta.length} digits`, forMeta };
  if (!forMeta.startsWith('54')) return { valid: false, error: `Invalid country code`, forMeta };
  return { valid: true, forMeta };
}

// =============================================================
// TEMPLATE CONFIG - Must match Meta WhatsApp Manager EXACTLY
// =============================================================
const TEMPLATE_CONFIG: Record<string, { paramCount: number }> = {
  'washero_on_the_way_u01': { paramCount: 2 },
  'washero_booking_confirmed_u01': { paramCount: 3 },
  'washero_reschedule_request': { paramCount: 1 },
};

function sanitizeParams(params: (string | null | undefined)[], expectedCount: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    const value = params[i];
    result.push(value ? String(value).trim() : 'N/D');
  }
  return result;
}

// =============================================================
// EMAIL FALLBACK
// =============================================================
async function sendEmailFallback(options: {
  to: string;
  customerName: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'hola@washero.ar';
  
  if (!resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Washero <${resendFromEmail}>`,
        to: [options.to],
        subject: options.subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a365d;">Washero</h2>
            <p>Hola ${options.customerName},</p>
            <p>${options.message}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #718096; font-size: 12px;">
              Este mensaje fue enviado por Washero. Si tenés consultas, respondé a este email.
            </p>
          </div>
        `,
      }),
    });
    
    if (response.ok) {
      return { success: true };
    }
    const result = await response.json();
    return { success: false, error: result.message || 'Email send failed' };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Meta WhatsApp API credentials
    const metaAccessToken = Deno.env.get('META_WA_ACCESS_TOKEN');
    const metaPhoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID');
    const metaConfigured = !!(metaAccessToken && metaPhoneNumberId);

    console.log('[admin-send-customer-notification] Config:', {
      metaConfigured,
      metaPhoneNumberId: metaPhoneNumberId ? `${metaPhoneNumberId.substring(0, 8)}...` : 'NOT SET',
    });

    // Auth check
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

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { booking_id, type } = await req.json() as NotificationRequest;
    if (!booking_id || !type) {
      return new Response(
        JSON.stringify({ error: 'booking_id and type required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch booking
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, customer_name, customer_phone, customer_email, address, booking_date, booking_time, service_name')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build message content
    const firstName = booking.customer_name?.split(' ')[0] || 'Cliente';
    const address = booking.address || 'tu ubicación';
    
    const dateObj = new Date(booking.booking_date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
    const timeFormatted = booking.booking_time || 'hora confirmada';

    let message = '';
    let templateName = '';
    let rawParams: (string | null)[] = [];
    let emailSubject = '';
    
    switch (type) {
      case 'ON_MY_WAY':
        templateName = 'washero_on_the_way_u01';
        rawParams = [firstName, `${dateFormatted} ${timeFormatted} en ${address}`];
        message = `Hola ${firstName}! Somos Washero 🚐. Estamos en camino. Tu turno es ${dateFormatted} ${timeFormatted} en ${address}.`;
        emailSubject = 'Washero: Estamos en camino 🚐';
        break;
      case 'BOOKING_CONFIRMED':
        templateName = 'washero_booking_confirmed_u01';
        rawParams = [firstName, `${dateFormatted} ${timeFormatted}`, address];
        message = `Hola ${firstName}! Tu reserva está confirmada para ${dateFormatted} ${timeFormatted} en ${address}. ¡Te esperamos!`;
        emailSubject = 'Washero: Tu reserva está confirmada ✅';
        break;
      case 'BOOKING_CANCELLED':
        templateName = 'washero_reschedule_request';
        rawParams = [firstName];
        message = `Hola ${firstName}! Tu reserva para ${dateFormatted} ha sido cancelada. Visitá washero.online para reagendar.`;
        emailSubject = 'Washero: Cambio en tu reserva';
        break;
    }

    // Validate and normalize phone
    const phoneValidation = validatePhone(booking.customer_phone);
    const phoneE164 = normalizePhoneE164(booking.customer_phone);

    // Log debug info
    console.log('[admin-send-customer-notification] Sending:', {
      booking_id,
      type,
      phone: phoneValidation.forMeta,
      phoneValid: phoneValidation.valid,
      template: templateName,
      paramCount: rawParams.length,
    });

    let whatsappSent = false;
    let whatsappMessageId: string | null = null;
    let whatsappError: string | null = null;
    let emailSent = false;
    let emailError: string | null = null;

    // ============================================================
    // TRY WHATSAPP FIRST
    // ============================================================
    if (metaConfigured && phoneValidation.valid) {
      const templateConfig = TEMPLATE_CONFIG[templateName];
      const sanitizedParams = sanitizeParams(rawParams, templateConfig?.paramCount || rawParams.length);
      
      // Build components
      const components = sanitizedParams.length > 0 ? [{
        type: 'body',
        parameters: sanitizedParams.map(text => ({ type: 'text', text })),
      }] : undefined;
      
      const requestBody = {
        messaging_product: 'whatsapp',
        to: phoneValidation.forMeta,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es_AR' },
          components,
        },
      };
      
      console.log('[admin-send-customer-notification] Meta API request:', JSON.stringify({
        to: phoneValidation.forMeta,
        template: templateName,
        language: 'es_AR',
        params: sanitizedParams,
      }));
      
      try {
        const response = await fetch(
          `https://graph.facebook.com/v20.0/${metaPhoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );
        
        const result = await response.json();
        
        console.log('[admin-send-customer-notification] Meta API response:', {
          status: response.status,
          ok: response.ok,
          messageId: result.messages?.[0]?.id,
          error: result.error,
        });
        
        if (response.ok && result.messages?.[0]?.id) {
          whatsappSent = true;
          whatsappMessageId = result.messages[0].id;
          console.log('[admin-send-customer-notification] WhatsApp SUCCESS:', whatsappMessageId);
        } else {
          const errorCode = result.error?.code || response.status;
          const errorMsg = result.error?.message || 'Meta API error';
          const errorData = result.error?.error_data;
          
          whatsappError = `META ${errorCode}: ${errorMsg}`;
          
          console.error('[admin-send-customer-notification] WhatsApp FAILED:', {
            code: errorCode,
            message: errorMsg,
            error_data: errorData,
            template: templateName,
            params: sanitizedParams,
          });
        }
      } catch (err: unknown) {
        whatsappError = `Network error: ${err instanceof Error ? err.message : String(err)}`;
        console.error('[admin-send-customer-notification] WhatsApp exception:', whatsappError);
      }
    } else if (!phoneValidation.valid) {
      whatsappError = `Invalid phone: ${phoneValidation.error}`;
      console.warn('[admin-send-customer-notification] Phone validation failed:', phoneValidation.error);
    } else {
      whatsappError = 'Meta WhatsApp not configured';
    }

    // ============================================================
    // EMAIL FALLBACK if WhatsApp failed
    // ============================================================
    if (!whatsappSent && booking.customer_email) {
      console.log('[admin-send-customer-notification] WhatsApp failed, trying email fallback...');
      
      const emailResult = await sendEmailFallback({
        to: booking.customer_email,
        customerName: firstName,
        subject: emailSubject,
        message: message,
      });
      
      emailSent = emailResult.success;
      emailError = emailResult.error || null;
      
      console.log('[admin-send-customer-notification] Email fallback result:', {
        sent: emailSent,
        error: emailError,
      });
    }

    // ============================================================
    // STORE IN DATABASE
    // ============================================================
    const channel = whatsappSent ? 'whatsapp' : (emailSent ? 'email' : 'failed');
    
    // Store in outgoing_messages
    await supabaseClient.from('outgoing_messages').insert({
      booking_id: booking.id,
      customer_phone: booking.customer_phone,
      type,
      channel,
      message,
      status: whatsappSent || emailSent ? 'sent' : 'failed',
      provider_message_id: whatsappMessageId,
      error: whatsappError || emailError,
    });

    // Store in whatsapp_messages if sent
    if (whatsappSent) {
      const { data: conv } = await supabaseClient
        .from('whatsapp_conversations')
        .select('id')
        .eq('customer_phone_e164', phoneE164)
        .maybeSingle();

      let convId = conv?.id;
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
        await supabaseClient.from('whatsapp_messages').insert({
          conversation_id: convId,
          direction: 'outbound',
          body: message,
          status: 'sent',
          twilio_message_sid: whatsappMessageId,
          created_by: user.id,
        });
      }
    }

    // Log to notification_logs for Admin visibility
    await supabaseClient.from('notification_logs').insert({
      booking_id: booking.id,
      notification_type: whatsappSent ? 'whatsapp' : 'email',
      recipient: whatsappSent ? phoneE164 : booking.customer_email,
      status: whatsappSent || emailSent ? 'sent' : 'failed',
      message_content: message,
      message_type: type,
      external_id: whatsappMessageId,
      error_message: whatsappError || emailError,
    });

    return new Response(
      JSON.stringify({
        ok: whatsappSent || emailSent,
        channel,
        whatsapp: {
          sent: whatsappSent,
          message_id: whatsappMessageId,
          error: whatsappError,
        },
        email: {
          sent: emailSent,
          error: emailError,
          fallback: !whatsappSent && emailSent,
        },
        message,
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
