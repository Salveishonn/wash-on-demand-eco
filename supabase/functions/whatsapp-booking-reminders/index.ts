import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * WhatsApp Booking Reminders
 * 
 * Called via cron or manually to send reminders:
 * - 1 hour before: "En aproximadamente 1 hora estaremos llegando"
 * - Tomorrow reminder: "Recordatorio: mañana tenés un lavado programado"
 * 
 * Also handles event-triggered messages:
 * - Worker "en_camino": "Ya estamos en camino"
 * - Worker "llegamos": "Ya llegamos al lugar acordado"
 */

interface ReminderRequest {
  type: 'upcoming_1h' | 'tomorrow_reminder' | 'en_camino' | 'llegamos';
  booking_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_WA_ACCESS_TOKEN');
    const metaPhoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID');
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    if (!metaAccessToken || !metaPhoneNumberId) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, booking_id } = await req.json() as ReminderRequest;
    const results: { booking_id: string; sent: boolean; error?: string }[] = [];

    // Helper to send free-text WhatsApp message
    async function sendText(phone: string, text: string): Promise<{ sent: boolean; messageId?: string; error?: string }> {
      // Normalize phone
      let cleaned = phone.replace(/[^\d+]/g, '');
      if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
      if (!cleaned.startsWith('54')) {
        if (cleaned.length === 10) cleaned = '549' + cleaned;
        else if (cleaned.startsWith('11')) cleaned = '549' + cleaned;
        else cleaned = '54' + cleaned;
      }

      try {
        const response = await fetch(
          `https://graph.facebook.com/v20.0/${metaPhoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleaned,
              type: 'text',
              text: { body: text },
            }),
          }
        );

        const result = await response.json();
        if (response.ok && result.messages?.[0]?.id) {
          return { sent: true, messageId: result.messages[0].id };
        }
        return { sent: false, error: result.error?.message || 'Meta API error' };
      } catch (err: unknown) {
        return { sent: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (type === 'en_camino' && booking_id) {
      const { data: b } = await supabaseClient
        .from('bookings')
        .select('customer_name, customer_phone')
        .eq('id', booking_id)
        .single();

      if (b) {
        const name = b.customer_name?.split(' ')[0] || 'Cliente';
        const res = await sendText(b.customer_phone, `Hola ${name} 👋\n\n🚐 Ya estamos en camino hacia tu ubicación.\n\n— Washero`);
        results.push({ booking_id, sent: res.sent, error: res.error });
      }
    }

    if (type === 'llegamos' && booking_id) {
      const { data: b } = await supabaseClient
        .from('bookings')
        .select('customer_name, customer_phone')
        .eq('id', booking_id)
        .single();

      if (b) {
        const name = b.customer_name?.split(' ')[0] || 'Cliente';
        const res = await sendText(b.customer_phone, `Hola ${name} 👋\n\n📍 Ya llegamos al lugar acordado.\n\n— Washero`);
        results.push({ booking_id, sent: res.sent, error: res.error });
      }
    }

    if (type === 'upcoming_1h') {
      // Find bookings in the next ~1 hour
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMin = currentMinutes + 50;
      const targetMax = currentMinutes + 70;

      const { data: bookings } = await supabaseClient
        .from('bookings')
        .select('id, customer_name, customer_phone, booking_time')
        .eq('booking_date', today)
        .eq('is_test', false)
        .in('status', ['pending', 'confirmed']);

      for (const b of bookings || []) {
        const [h, m] = (b.booking_time || '12:00').split(':').map(Number);
        const bookingMinutes = h * 60 + m;
        if (bookingMinutes >= targetMin && bookingMinutes <= targetMax) {
          const name = b.customer_name?.split(' ')[0] || 'Cliente';
          const res = await sendText(b.customer_phone,
            `Hola ${name} 👋\n\nEn aproximadamente 1 hora estaremos llegando para tu lavado.\n\n🚗 ¡Preparate!\n\n— Washero`
          );
          results.push({ booking_id: b.id, sent: res.sent, error: res.error });
        }
      }
    }

    if (type === 'tomorrow_reminder') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: bookings } = await supabaseClient
        .from('bookings')
        .select('id, customer_name, customer_phone, booking_time')
        .eq('booking_date', tomorrowStr)
        .eq('is_test', false)
        .in('status', ['pending', 'confirmed']);

      for (const b of bookings || []) {
        const name = b.customer_name?.split(' ')[0] || 'Cliente';
        const time = b.booking_time?.slice(0, 5) || '';
        const res = await sendText(b.customer_phone,
          `Hola ${name} 👋\n\nRecordatorio: mañana tenés un lavado programado con Washero a las ${time}.\n\n🧽 ¡Te esperamos!\n\n— Washero`
        );
        results.push({ booking_id: b.id, sent: res.sent, error: res.error });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, type, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[whatsapp-booking-reminders] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
