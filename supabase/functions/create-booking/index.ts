import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddonItem {
  code: string;
  name: string;
  price_ars: number;
}

interface CreateBookingRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  serviceCode?: string;
  vehicleSize?: string;
  pricingVersionId?: string;
  basePriceArs?: number;
  vehicleExtraArs?: number;
  extrasTotalArs?: number;
  totalPriceArs?: number;
  // Legacy fields for backwards compatibility
  servicePriceCents?: number;
  carType?: string;
  carTypeExtraCents?: number;
  bookingDate: string;
  bookingTime: string;
  address: string;
  notes?: string;
  userId?: string;
  subscriptionId?: string;
  isSubscriptionBooking?: boolean;
  bookingType?: "single" | "subscription";
  paymentMethod?: "online" | "transfer" | "pay_later" | "subscription";
  whatsappOptIn?: boolean;
  kipperOptIn?: boolean;
  addons?: AddonItem[];
  addonsTotalCents?: number;
  bookingSource?: string;
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
    console.log("[create-booking] Booking type:", data.bookingType);

    // Validate required fields
    const validationErrors: string[] = [];
    if (!data.customerName?.trim()) validationErrors.push("Nombre es requerido");
    if (!data.customerEmail?.trim()) validationErrors.push("Email es requerido");
    if (!data.customerPhone?.trim()) validationErrors.push("Teléfono es requerido");
    if (!data.serviceName?.trim()) validationErrors.push("Servicio es requerido");
    if (!data.bookingDate) validationErrors.push("Fecha es requerida");
    if (!data.bookingTime) validationErrors.push("Horario es requerido");
    if (!data.address?.trim()) validationErrors.push("Dirección es requerida");
    
    if (validationErrors.length > 0) {
      console.error("[create-booking] Validation errors:", validationErrors);
      return new Response(
        JSON.stringify({ 
          error: "Faltan datos requeridos", 
          validationErrors,
          message: validationErrors.join(", ")
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine booking type
    const isSubscription: boolean = Boolean(
      data.bookingType === "subscription" || 
      (data.isSubscriptionBooking === true && data.subscriptionId)
    );
    const isTransfer: boolean = data.paymentMethod === "transfer";
    const isPayLater: boolean = data.paymentMethod === "pay_later";
    const whatsappOptIn: boolean = Boolean(data.whatsappOptIn);

    console.log("[create-booking] isSubscription:", isSubscription, "isTransfer:", isTransfer, "isPayLater:", isPayLater);

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

      if (subscription.status !== "active" && subscription.status !== "pending") {
        throw new Error("Tu suscripción no está activa");
      }

      if (subscription.washes_remaining <= 0) {
        throw new Error("No te quedan lavados disponibles este mes");
      }

      // Decrement washes remaining
      await supabase
        .from("subscriptions")
        .update({ 
          washes_remaining: subscription.washes_remaining - 1,
          washes_used_in_cycle: (subscription.washes_used_in_cycle || 0) + 1
        })
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
      bookingStatus = "pending";
      paymentStatus = "pending";
      requiresPayment = false;
      paymentMethodValue = data.paymentMethod || "pay_later";
    }

    // Prepare addons data - support both new and legacy format
    const addonsData = data.addons || [];
    const addonsTotalCents = data.addonsTotalCents || 
      (data.extrasTotalArs ? data.extrasTotalArs * 100 : 
        addonsData.reduce((sum, a) => sum + (a.price_ars ? a.price_ars * 100 : 0), 0));

    // Calculate pricing - support both new (ARS) and legacy (cents) formats
    const basePriceCents = data.basePriceArs ? data.basePriceArs * 100 : (data.servicePriceCents || 0);
    const vehicleExtraCents = data.vehicleExtraArs ? data.vehicleExtraArs * 100 : (data.carTypeExtraCents || 0);
    const totalPriceCents = data.totalPriceArs ? data.totalPriceArs * 100 : 
      (basePriceCents + vehicleExtraCents + addonsTotalCents);

    // Normalize phone to E.164 for Argentina
    let phoneE164 = data.customerPhone.trim().replace(/[^0-9+]/g, "");
    if (!phoneE164.startsWith("+")) {
      if (phoneE164.startsWith("54")) {
        phoneE164 = "+" + phoneE164;
      } else if (phoneE164.startsWith("11") || phoneE164.startsWith("15")) {
        phoneE164 = "+549" + phoneE164.replace(/^15/, "");
      } else {
        phoneE164 = "+54" + phoneE164;
      }
    }

    // Upsert customer
    let customerId: string | null = null;
    if (data.whatsappOptIn) {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone_e164", phoneE164)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        await supabase
          .from("customers")
          .update({
            full_name: data.customerName.trim(),
            email: data.customerEmail.trim().toLowerCase(),
            whatsapp_opt_in: true,
            whatsapp_opt_in_at: new Date().toISOString(),
          })
          .eq("id", customerId);
      } else {
        const { data: newCustomer } = await supabase
          .from("customers")
          .insert({
            full_name: data.customerName.trim(),
            email: data.customerEmail.trim().toLowerCase(),
            phone_e164: phoneE164,
            whatsapp_opt_in: true,
            whatsapp_opt_in_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        customerId = newCustomer?.id || null;
      }
      console.log("[create-booking] Customer upserted:", customerId);
    }

    // Create the booking with new pricing structure
    const bookingInsertData = {
      user_id: data.userId || null,
      subscription_id: data.subscriptionId || null,
      customer_id: customerId,
      customer_name: data.customerName.trim(),
      customer_email: data.customerEmail.trim().toLowerCase(),
      customer_phone: data.customerPhone.trim(),
      service_name: data.serviceName,
      service_code: data.serviceCode || null,
      vehicle_size: data.vehicleSize || null,
      pricing_version_id: data.pricingVersionId || null,
      service_price_cents: basePriceCents,
      car_type: data.carType || data.vehicleSize || null,
      car_type_extra_cents: vehicleExtraCents,
      booking_date: data.bookingDate,
      booking_time: data.bookingTime,
      address: data.address.trim(),
      notes: data.notes?.trim() || null,
      booking_type: isSubscription ? "subscription" : "single",
      is_subscription_booking: isSubscription,
      requires_payment: Boolean(requiresPayment),
      status: bookingStatus,
      payment_status: paymentStatus,
      payment_method: paymentMethodValue,
      confirmed_at: isSubscription ? new Date().toISOString() : null,
      addons: addonsData,
      addons_total_cents: addonsTotalCents,
      base_price_ars: data.basePriceArs || Math.round(basePriceCents / 100),
      vehicle_extra_ars: data.vehicleExtraArs || Math.round(vehicleExtraCents / 100),
      extras_total_ars: data.extrasTotalArs || Math.round(addonsTotalCents / 100),
      total_price_ars: data.totalPriceArs || Math.round(totalPriceCents / 100),
      booking_source: data.bookingSource || "direct",
      whatsapp_opt_in: whatsappOptIn,
    };

    console.log("[create-booking] Insert payload:", JSON.stringify(bookingInsertData, null, 2));

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert(bookingInsertData)
      .select()
      .single();

    if (bookingError) {
      console.error("[create-booking] Error creating booking:", bookingError);
      
      if (bookingError.code === "23505") {
        return new Response(
          JSON.stringify({ 
            error: "Ese horario ya fue reservado. Elegí otro.",
            slotTaken: true,
            code: "SLOT_TAKEN"
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Error al crear la reserva", 
          details: bookingError.message,
          code: bookingError.code 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-booking] Booking created:", booking.id);

    // Create payment intent for non-subscription bookings
    let paymentIntent = null;
    let paymentUrl = null;
    
    if (!isSubscription) {
      const totalAmountArs = data.totalPriceArs || Math.round(totalPriceCents / 100);
      
      const { data: intentData, error: intentError } = await supabase
        .from("payment_intents")
        .insert({
          booking_id: booking.id,
          type: "one_time",
          amount_ars: totalAmountArs,
          currency: "ARS",
          status: "pending",
          expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (intentError) {
        console.error("[create-booking] Payment intent error:", intentError);
      } else {
        paymentIntent = intentData;
        
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

    // Handle Kipper opt-in
    if (data.kipperOptIn) {
      console.log("[create-booking] Creating Kipper lead");
      const { error: kipperError } = await supabase.from("kipper_leads").insert({
        customer_name: data.customerName.trim(),
        customer_email: data.customerEmail.trim().toLowerCase(),
        customer_phone: data.customerPhone.trim(),
        booking_id: booking.id,
        source: "booking",
        vehicle_type: data.carType || data.vehicleSize || null,
      });
      if (kipperError) console.error("[create-booking] Kipper lead error:", kipperError);
    }

    // For transfer bookings, send payment instructions
    if (isTransfer && data.customerEmail && paymentIntent) {
      console.log("[create-booking] Sending payment instructions to:", data.customerEmail);
      
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

    // Emit webhook event
    const notifyEventUrl = `${supabaseUrl}/functions/v1/notify-event`;
    fetch(notifyEventUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        event: "booking.created",
        timestamp: new Date().toISOString(),
        user_id: data.userId,
        customer_email: data.customerEmail,
        customer_phone: data.customerPhone,
        customer_name: data.customerName,
        booking_id: booking.id,
        amount_ars: data.totalPriceArs || Math.round(totalPriceCents / 100),
        status: bookingStatus,
        metadata: { 
          payment_method: paymentMethodValue,
          is_subscription: isSubscription,
          is_transfer: isTransfer
        },
      }),
    }).catch(err => console.error("[create-booking] Notify event error:", err));

    // Emit payment_required event if transfer booking
    if (isTransfer && paymentIntent) {
      fetch(notifyEventUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          event: "booking.payment_required",
          timestamp: new Date().toISOString(),
          user_id: data.userId,
          customer_email: data.customerEmail,
          customer_phone: data.customerPhone,
          customer_name: data.customerName,
          booking_id: booking.id,
          amount_ars: data.totalPriceArs || Math.round(totalPriceCents / 100),
          status: "pending",
          metadata: { payment_url: paymentUrl },
        }),
      }).catch(err => console.error("[create-booking] Payment required event error:", err));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        bookingId: booking.id,
        booking,
        paymentIntent,
        paymentIntentId: paymentIntent?.id,
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
