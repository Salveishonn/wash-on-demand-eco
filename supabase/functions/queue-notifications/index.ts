import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueueNotificationsRequest {
  bookingId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { bookingId }: QueueNotificationsRequest = await req.json();
    
    console.log(`[queue-notifications] Processing booking: ${bookingId}`);

    // Check if notifications already queued (idempotency at booking level)
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, notifications_queued")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      console.error("[queue-notifications] Booking not found:", bookingError);
      throw new Error("Reserva no encontrada");
    }

    if (booking.notifications_queued) {
      console.log("[queue-notifications] Notifications already queued, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Already queued" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminEmail = "washerocarwash@gmail.com";
    const adminWhatsApp = "+5491130951804";

    // Create idempotency keys
    const emailIdempotencyKey = `${bookingId}:email:admin`;
    const whatsappIdempotencyKey = `${bookingId}:whatsapp:admin`;

    // Queue email notification
    const { error: emailQueueError } = await supabase
      .from("notification_queue")
      .upsert({
        booking_id: bookingId,
        notification_type: "email",
        recipient: adminEmail,
        idempotency_key: emailIdempotencyKey,
        status: "pending",
        next_retry_at: new Date().toISOString(),
      }, {
        onConflict: "idempotency_key",
        ignoreDuplicates: true,
      });

    if (emailQueueError) {
      console.error("[queue-notifications] Error queuing email:", emailQueueError);
    }

    // Queue WhatsApp notification
    const { error: whatsappQueueError } = await supabase
      .from("notification_queue")
      .upsert({
        booking_id: bookingId,
        notification_type: "whatsapp",
        recipient: adminWhatsApp,
        idempotency_key: whatsappIdempotencyKey,
        status: "pending",
        next_retry_at: new Date().toISOString(),
      }, {
        onConflict: "idempotency_key",
        ignoreDuplicates: true,
      });

    if (whatsappQueueError) {
      console.error("[queue-notifications] Error queuing whatsapp:", whatsappQueueError);
    }

    // Mark booking as notifications queued
    await supabase
      .from("bookings")
      .update({ notifications_queued: true })
      .eq("id", bookingId);

    console.log("[queue-notifications] Notifications queued successfully");

    // Trigger immediate processing
    const processUrl = `${supabaseUrl}/functions/v1/process-notifications`;
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({}),
    }).catch(err => console.error("[queue-notifications] Process trigger error:", err));

    return new Response(
      JSON.stringify({ success: true, message: "Notifications queued" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[queue-notifications] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
