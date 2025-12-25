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
  paymentMethod?: "transfer" | "pay_later" | "subscription";
  whatsappOptIn?: boolean;
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
    console.log("[create-booking] Payment method:", data.paymentMethod);

    // Validate required fields
    if (!data.customerName || !data.customerEmail || !data.customerPhone) {
      throw new Error("Faltan datos del cliente");
    }
    if (!data.serviceName || !data.bookingDate || !data.bookingTime) {
      throw new Error("Faltan datos del servicio o fecha");
    }

    const isSubscription = data.isSubscriptionBooking === true && data.subscriptionId;
    const isTransfer = data.paymentMethod === "transfer";
    const isPayLater = data.paymentMethod === "pay_later";

    // If subscription booking, verify subscription is active
    if (isSubscription && data.subscriptionId) {
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

    // Determine booking/payment status based on payment method
    let bookingStatus: string;
    let paymentStatus: string;
    let requiresPayment: boolean;
    let paymentMethodValue: string | null = null;

    if (isSubscription) {
      bookingStatus = "confirmed";
      paymentStatus = "approved";
      requiresPayment = false;
      paymentMethodValue = "subscription";
    } else if (isTransfer) {
      bookingStatus = "pending";
      paymentStatus = "pending";
      requiresPayment = true;
      paymentMethodValue = "transfer";
    } else {
      // Pay later / cash
      bookingStatus = "pending";
      paymentStatus = "pending";
      requiresPayment = false;
      paymentMethodValue = "pay_later";
    }

    console.log("[create-booking] Status - booking:", bookingStatus, "payment:", paymentStatus);

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
        is_subscription_booking: isSubscription,
        requires_payment: requiresPayment,
        status: bookingStatus,
        payment_status: paymentStatus,
        payment_method: paymentMethodValue,
        confirmed_at: isSubscription ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (bookingError) {
      console.error("[create-booking] Error creating booking:", bookingError);
      throw new Error("Error al crear la reserva");
    }

    console.log("[create-booking] Booking created:", booking.id);

    // Create payment intent for transfer or pay_later bookings
    let paymentIntent = null;
    let paymentUrl = null;
    
    if (!isSubscription) {
      const totalAmount = data.servicePriceCents + (data.carTypeExtraCents || 0);
      // Convert cents to ARS (divide by 100)
      const amountArs = Math.round(totalAmount / 100);
      
      const { data: intentData, error: intentError } = await supabase
        .from("payment_intents")
        .insert({
          booking_id: booking.id,
          type: "one_time",
          amount_ars: amountArs,
          currency: "ARS",
          status: "pending",
          expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
        })
        .select()
        .single();

      if (intentError) {
        console.error("[create-booking] Payment intent error:", intentError);
        // Non-fatal, continue
      } else {
        paymentIntent = intentData;
        
        // Update booking with payment_intent_id
        await supabase
          .from("bookings")
          .update({ payment_intent_id: intentData.id })
          .eq("id", booking.id);

        const baseUrl = "https://washero.online";
        paymentUrl = `${baseUrl}/pagar/${intentData.id}`;
        
        console.log("[create-booking] Payment intent created:", intentData.id);
      }
    }

    // Queue admin notifications
    const shouldNotifyAdmin = isSubscription || !isSubscription; // Always notify
    
    if (shouldNotifyAdmin) {
      console.log("[create-booking] Queueing admin notifications");
      
      const queueUrl = `${supabaseUrl}/functions/v1/queue-notifications`;
      
      fetch(queueUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ 
          bookingId: booking.id,
          isPayLater: isPayLater,
          isTransfer: isTransfer,
          isSubscription: isSubscription,
          whatsappOptIn: data.whatsappOptIn || false
        }),
      }).catch(err => console.error("[create-booking] Queue error:", err));
    }

    // For transfer bookings, send payment instructions to customer with payment page link
    if (isTransfer && data.customerEmail && paymentIntent) {
      console.log("[create-booking] Sending payment instructions to customer:", data.customerEmail);
      
      const sendNotificationsUrl = `${supabaseUrl}/functions/v1/send-notifications`;
      
      fetch(sendNotificationsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ 
          bookingId: booking.id,
          messageType: "payment_instructions",
          paymentIntentId: paymentIntent.id,
          paymentUrl: paymentUrl
        }),
      }).catch(err => console.error("[create-booking] Payment instructions error:", err));
    }

    // Determine response message
    let message: string;
    if (isSubscription) {
      message = "¡Reserva confirmada con tu suscripción!";
    } else if (isTransfer) {
      message = "¡Reserva recibida! Te enviamos las instrucciones de pago por email.";
    } else {
      message = "¡Reserva recibida! Te contactaremos para coordinar el pago.";
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking,
        paymentIntent,
        paymentUrl,
        message,
        isTransfer,
        isPayLater,
        isSubscription,
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