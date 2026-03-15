import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { queueTemplateSend, triggerOutboxProcessing } from "../_whatsappAutomation/queueTemplateSend.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * WhatsApp Booking Reminders
 * 
 * Handles both cron-based and event-triggered messages using TEMPLATES:
 * - Worker "en_camino": washero_on_the_way_u01 template
 * - Worker "llegamos": washero_arrived template
 * - upcoming_1h / tomorrow_reminder: freeform text (within 24h window)
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!metaAccessToken || !metaPhoneNumberId) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, booking_id } = await req.json() as ReminderRequest;
    const results: { booking_id: string; sent: boolean; queued?: boolean; templateName?: string; error?: string }[] = [];

    // Helper to send free-text WhatsApp message (for reminders within 24h window)
    async function sendText(phone: string, text: string): Promise<{ sent: boolean; messageId?: string; error?: string }> {
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

    // ── EN CAMINO: Use template (works outside 24h window) ──
    if (type === 'en_camino' && booking_id) {
      const { data: b } = await supabase
        .from('bookings')
        .select('customer_name, customer_phone, booking_date, booking_time, address')
        .eq('id', booking_id)
        .single();

      if (b) {
        console.log('[whatsapp-reminders] en_camino: queuing template for', b.customer_phone);
        const result = await queueTemplateSend(
          supabase,
          'worker_en_route',
          {
            customerName: b.customer_name,
            customerPhone: b.customer_phone,
            bookingDate: b.booking_date,
            bookingTime: b.booking_time,
            address: b.address || undefined,
            bookingId: booking_id,
          },
          'reservation',
          booking_id,
        );
        results.push({ booking_id, sent: false, queued: result.queued, templateName: result.templateName, error: result.error });
        
        if (result.queued) {
          triggerOutboxProcessing(supabaseUrl, supabaseServiceKey);
        }
      }
    }

    // ── LLEGAMOS: Use template (works outside 24h window) ──
    if (type === 'llegamos' && booking_id) {
      const { data: b } = await supabase
        .from('bookings')
        .select('customer_name, customer_phone, booking_date, booking_time, address')
        .eq('id', booking_id)
        .single();

      if (b) {
        console.log('[whatsapp-reminders] llegamos: queuing template for', b.customer_phone);
        const result = await queueTemplateSend(
          supabase,
          'worker_arrived',
          {
            customerName: b.customer_name,
            customerPhone: b.customer_phone,
            bookingDate: b.booking_date,
            bookingTime: b.booking_time,
            address: b.address || undefined,
            bookingId: booking_id,
          },
          'reservation',
          booking_id,
        );
        results.push({ booking_id, sent: false, queued: result.queued, templateName: result.templateName, error: result.error });
        
        if (result.queued) {
          triggerOutboxProcessing(supabaseUrl, supabaseServiceKey);
        }
      }
    }

    // ── UPCOMING 1H: Use freeform text (should be within 24h window from booking confirmation) ──
    if (type === 'upcoming_1h') {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMin = currentMinutes + 50;
      const targetMax = currentMinutes + 70;

      const { data: bookings } = await supabase
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

    // ── TOMORROW REMINDER: Use freeform text ──
    if (type === 'tomorrow_reminder') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: bookings } = await supabase
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
