import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  booking_id: string;
  type: 'ON_MY_WAY';
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
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { booking_id, type } = await req.json() as NotificationRequest;

    if (!booking_id || type !== 'ON_MY_WAY') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: booking_id and type=ON_MY_WAY required' }),
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
      console.error('Booking fetch error:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build message
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
    
    const message = `${greeting} Soy Washero 🚐. Estamos en camino hacia ${address}. Tu turno es ${dateFormatted} ${booking.booking_time}. Si necesitás reprogramar, respondé este mensaje.`;

    let channel = 'pending';
    let stored = true;
    let providerMessageId: string | null = null;
    let sendError: string | null = null;

    // Try to send via existing WhatsApp if configured
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    const whatsappMode = Deno.env.get('WHATSAPP_MODE');

    if (twilioAccountSid && twilioAuthToken && twilioWhatsAppNumber && whatsappMode === 'production') {
      try {
        // Format phone number for WhatsApp
        let phone = booking.customer_phone.replace(/\D/g, '');
        if (!phone.startsWith('54')) {
          phone = '54' + phone;
        }
        const toNumber = `whatsapp:+${phone}`;
        const fromNumber = twilioWhatsAppNumber.startsWith('whatsapp:') 
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
            From: fromNumber,
            Body: message,
          }),
        });

        const twilioResult = await twilioResponse.json();
        
        if (twilioResponse.ok && twilioResult.sid) {
          channel = 'whatsapp';
          providerMessageId = twilioResult.sid;
          console.log('WhatsApp message sent:', twilioResult.sid);
        } else {
          console.error('Twilio error:', twilioResult);
          sendError = twilioResult.message || 'Failed to send WhatsApp';
          channel = 'pending';
        }
      } catch (twilioError) {
        console.error('Twilio exception:', twilioError);
        sendError = String(twilioError);
        channel = 'pending';
      }
    } else {
      console.log('WhatsApp not configured or not in production mode, storing message for later');
    }

    // Store in outgoing_messages table
    const { data: insertedMessage, error: insertError } = await supabaseClient
      .from('outgoing_messages')
      .insert({
        booking_id: booking.id,
        customer_phone: booking.customer_phone,
        type,
        channel,
        message,
        status: channel === 'whatsapp' ? 'sent' : 'queued',
        provider_message_id: providerMessageId,
        error: sendError,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store message:', insertError);
      // Don't fail the request, message was potentially sent
    }

    console.log('Customer notification processed:', {
      booking_id,
      type,
      channel,
      stored: !!insertedMessage,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        channel,
        message,
        stored: !!insertedMessage,
        sent: channel === 'whatsapp',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-send-customer-notification:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
