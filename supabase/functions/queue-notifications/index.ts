import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueueNotificationsRequest {
  bookingId: string;
  isPayLater?: boolean;
  whatsappOptIn?: boolean;
}

// Admin recipients
const ADMIN_EMAIL = "washerocarwash@gmail.com";
const ADMIN_WHATSAPP = "+5491130951804";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // WhatsApp mode: "sandbox" = only admin gets WhatsApp, "production" = everyone
  const whatsappMode = Deno.env.get("WHATSAPP_MODE") || "sandbox";

  try {
    const { bookingId, isPayLater, whatsappOptIn }: QueueNotificationsRequest = await req.json();
    
    console.log(`[queue-notifications] Processing booking: ${bookingId}, isPayLater: ${isPayLater}, whatsappOptIn: ${whatsappOptIn}, whatsappMode: ${whatsappMode}`);

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

    const notifications = [];

    // ===== CUSTOMER NOTIFICATIONS =====
    
    // Customer email notification (ALWAYS sent)
    notifications.push({
      booking_id: bookingId,
      notification_type: "email",
      recipient: booking.customer_email,
      idempotency_key: `${bookingId}:email:customer`,
      status: "pending",
      next_retry_at: new Date().toISOString(),
    });

    // Customer WhatsApp notification
    // Only send if:
    // 1. In production mode OR
    // 2. Customer explicitly opted in (we'll attempt anyway but log warning in sandbox)
    if (whatsappMode === "production" && whatsappOptIn) {
      notifications.push({
        booking_id: bookingId,
        notification_type: "whatsapp",
        recipient: booking.customer_phone,
        idempotency_key: `${bookingId}:whatsapp:customer`,
        status: "pending",
        next_retry_at: new Date().toISOString(),
      });
      console.log("[queue-notifications] Customer WhatsApp queued (production mode + opt-in)");
    } else if (whatsappMode === "sandbox" && whatsappOptIn) {
      // In sandbox mode, log that customer opted in but we can't send
      console.log("[queue-notifications] Customer opted in for WhatsApp but sandbox mode active - email only");
    }

    // ===== ADMIN NOTIFICATIONS =====
    
    // Admin email notification (ALWAYS sent)
    notifications.push({
      booking_id: bookingId,
      notification_type: "email",
      recipient: ADMIN_EMAIL,
      idempotency_key: `${bookingId}:email:admin`,
      status: "pending",
      next_retry_at: new Date().toISOString(),
    });

    // Admin WhatsApp notification (ALWAYS sent - sandbox works for admin)
    notifications.push({
      booking_id: bookingId,
      notification_type: "whatsapp",
      recipient: ADMIN_WHATSAPP,
      idempotency_key: `${bookingId}:whatsapp:admin`,
      status: "pending",
      next_retry_at: new Date().toISOString(),
    });

    console.log(`[queue-notifications] Queuing ${notifications.length} notifications`);

    // Insert all notifications
    for (const notification of notifications) {
      const { error } = await supabase
        .from("notification_queue")
        .upsert(notification, {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        });

      if (error) {
        console.error(`[queue-notifications] Error queuing ${notification.notification_type} to ${notification.recipient}:`, error);
      }
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
      body: JSON.stringify({ bookingId, isPayLater }),
    }).catch(err => console.error("[queue-notifications] Process trigger error:", err));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notifications queued", 
        count: notifications.length,
        whatsappMode 
      }),
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
