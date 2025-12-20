import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateBookingRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  servicePriceCents: number;
  carType: string;
  carTypeExtraCents: number;
  bookingDate: string;
  bookingTime: string;
  address: string;
  notes?: string;
  userId?: string;
  subscriptionId?: string;
  isSubscriptionBooking?: boolean;
  requiresPayment?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const data: CreateBookingRequest = await req.json();
    
    console.log("[create-booking] Creating booking for:", data.customerName);

    // Validate required fields
    if (!data.customerName || !data.customerEmail || !data.customerPhone) {
      throw new Error("Faltan datos del cliente");
    }
    if (!data.serviceName || !data.bookingDate || !data.bookingTime) {
      throw new Error("Faltan datos del servicio o fecha");
    }

    // If subscription booking, verify subscription is active
    if (data.isSubscriptionBooking && data.subscriptionId) {
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("id", data.subscriptionId)
        .maybeSingle();

      if (subError || !subscription) {
        throw new Error("Suscripción no encontrada");
      }

      if (subscription.status !== "active") {
        throw new Error("Tu suscripción no está activa");
      }

      if (subscription.washes_remaining <= 0) {
        throw new Error("No te quedan lavados disponibles este mes");
      }

      // Decrement washes remaining
      await supabase
        .from("subscriptions")
        .update({ washes_remaining: subscription.washes_remaining - 1 })
        .eq("id", data.subscriptionId);

      console.log("[create-booking] Subscription booking - washes remaining updated");
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        user_id: data.userId || null,
        subscription_id: data.subscriptionId || null,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        customer_phone: data.customerPhone,
        service_name: data.serviceName,
        service_price_cents: data.servicePriceCents,
        car_type: data.carType,
        car_type_extra_cents: data.carTypeExtraCents || 0,
        booking_date: data.bookingDate,
        booking_time: data.bookingTime,
        address: data.address,
        notes: data.notes,
        is_subscription_booking: data.isSubscriptionBooking || false,
        requires_payment: data.requiresPayment !== false,
        status: data.isSubscriptionBooking ? "confirmed" : "pending",
        payment_status: data.isSubscriptionBooking ? "approved" : "pending",
        confirmed_at: data.isSubscriptionBooking ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (bookingError) {
      console.error("[create-booking] Error creating booking:", bookingError);
      throw new Error("Error al crear la reserva");
    }

    console.log("[create-booking] Booking created:", booking.id);

    // If subscription booking, queue notifications immediately
    if (data.isSubscriptionBooking) {
      console.log("[create-booking] Queueing notifications for subscription booking");
      
      const queueUrl = `${supabaseUrl}/functions/v1/queue-notifications`;
      
      fetch(queueUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ bookingId: booking.id }),
      }).catch(err => console.error("[create-booking] Queue error:", err));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking,
        message: data.isSubscriptionBooking 
          ? "¡Reserva confirmada con tu suscripción!" 
          : "Reserva creada, procedé al pago"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-booking] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
