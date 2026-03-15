import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError, isRateLimited, isHoneypotTriggered, isTooFastSubmission } from "../_shared/securityUtils.ts";
import {
  validateBookingInput,
  validateCoverage,
  validateAvailability,
  resolveBookingKind,
  calculateBookingFinancials,
} from "../_shared/bookingDomain.ts";
import type { BookingInput } from "../_shared/bookingDomain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default launch date — can be overridden by app_settings
const DEFAULT_LAUNCH_DATE = "2026-04-15";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let data: BookingInput & { _hp?: string; _ts?: number } | undefined;
  try {
    // ========== RATE LIMITING ==========
    const rateLimited = await isRateLimited("create-booking", 5, 5, req);
    if (rateLimited) {
      await logError("create-booking", "rate_limit", "Rate limit exceeded for booking creation", {}, req);
      return new Response(
        JSON.stringify({ error: "Demasiados intentos. Esperá un momento antes de intentar de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    data = await req.json();

    // ========== ANTI-BOT ==========
    if (isHoneypotTriggered(data._hp)) {
      await logError("create-booking", "honeypot", "Bot detected via honeypot", {}, req);
      return new Response(
        JSON.stringify({ success: true, bookingId: "00000000-0000-0000-0000-000000000000" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isTooFastSubmission(data._ts)) {
      await logError("create-booking", "too_fast", "Submission completed too quickly", {}, req);
      return new Response(
        JSON.stringify({ success: true, bookingId: "00000000-0000-0000-0000-000000000000" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-booking] Creating booking for:", data.customerName);

    // ========== 1. VALIDATE INPUT ==========
    const validation = validateBookingInput(data as BookingInput);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: "Faltan datos requeridos", validationErrors: validation.errors, message: validation.errors.join(", ") }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== 2. VALIDATE COVERAGE ==========
    const coverage = validateCoverage(data.address);
    if (!coverage.allowed) {
      return new Response(
        JSON.stringify({ error: "Dirección fuera de zona operativa", message: coverage.reason }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== 3. LAUNCH DATE CHECK REMOVED ==========
    // Launch date restriction disabled — admin availability is the single source of truth.
    // Only past-date prevention (handled by frontend) and admin availability (step 4) apply.

    // ========== 4. VALIDATE AVAILABILITY ==========
    const availability = await validateAvailability(supabase, data.bookingDate, data.bookingTime);
    if (!availability.available) {
      return new Response(
        JSON.stringify({ error: availability.reason }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== 5. RESOLVE BOOKING KIND ==========
    const kind = resolveBookingKind(data as BookingInput);

    // ========== 6. SUBSCRIPTION VALIDATION ==========
    if (kind.isSubscription && data.subscriptionId) {
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("id", data.subscriptionId)
        .maybeSingle();

      if (subError || !subscription) {
        throw new Error("Suscripción no encontrada");
      }
      if (subscription.status !== "active") {
        throw new Error("Tu suscripción no está activa. Estado actual: " + subscription.status);
      }
      if (subscription.washes_remaining <= 0) {
        throw new Error("No te quedan lavados disponibles este mes");
      }

      // Atomic decrement
      const { data: updated, error: updateError } = await supabase
        .from("subscriptions")
        .update({
          washes_remaining: subscription.washes_remaining - 1,
          washes_used_in_cycle: (subscription.washes_used_in_cycle || 0) + 1,
        })
        .eq("id", data.subscriptionId)
        .gt("washes_remaining", 0)
        .select("washes_remaining")
        .maybeSingle();

      if (updateError) throw new Error("Error al actualizar los créditos de suscripción");
      if (!updated) throw new Error("No te quedan lavados disponibles este mes");

      console.log("[create-booking] Subscription credits updated:", updated.washes_remaining);
    }

    // ========== 7. CALCULATE FINANCIALS ==========
    const financials = await calculateBookingFinancials(supabase, data as BookingInput, kind.isSubscription);

    if (financials.priceMismatch) {
      console.warn("[create-booking] PRICE MISMATCH detected");
      await logError("create-booking", "price_mismatch", "Client price differs from server price", {
        serviceCode: data.serviceCode,
        vehicleSize: data.vehicleSize,
      }, req);
    }

    // ========== 8. UPSERT CUSTOMER ==========
    let phoneE164 = data.customerPhone.trim().replace(/[^0-9+]/g, "");
    if (!phoneE164.startsWith("+")) {
      if (phoneE164.startsWith("54")) phoneE164 = "+" + phoneE164;
      else if (phoneE164.startsWith("11") || phoneE164.startsWith("15")) phoneE164 = "+549" + phoneE164.replace(/^15/, "");
      else phoneE164 = "+54" + phoneE164;
    }

    let customerId: string | null = null;
    if (data.whatsappOptIn) {
      const { data: existingCustomer } = await supabase
        .from("customers").select("id").eq("phone_e164", phoneE164).maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        await supabase.from("customers").update({
          full_name: data.customerName.trim(),
          email: data.customerEmail.trim().toLowerCase(),
          whatsapp_opt_in: true,
          whatsapp_opt_in_at: new Date().toISOString(),
        }).eq("id", customerId);
      } else {
        const { data: newCustomer } = await supabase.from("customers").insert({
          full_name: data.customerName.trim(),
          email: data.customerEmail.trim().toLowerCase(),
          phone_e164: phoneE164,
          whatsapp_opt_in: true,
          whatsapp_opt_in_at: new Date().toISOString(),
        }).select("id").single();
        customerId = newCustomer?.id || null;
      }
    }

    // ========== 9. CREATE BOOKING RECORD ==========
    const barrio = data.barrio?.trim() || null;
    const barrioGroupKey = barrio && data.bookingDate ? `${barrio.toLowerCase()}::${data.bookingDate}` : null;
    const addonsData = data.addons || [];

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
      pricing_version_id: financials.pricingVersionId,
      service_price_cents: financials.basePriceCents,
      car_type: data.carType || data.vehicleSize || null,
      car_type_extra_cents: financials.vehicleExtraCents,
      booking_date: data.bookingDate,
      booking_time: data.bookingTime,
      address: data.address.trim(),
      notes: data.notes?.trim() || null,
      booking_type: kind.isSubscription ? "subscription" : "single",
      is_subscription_booking: kind.isSubscription,
      requires_payment: Boolean(kind.requiresPayment),
      status: kind.bookingStatus,
      payment_status: kind.paymentStatus,
      payment_method: kind.paymentMethodValue,
      confirmed_at: kind.isSubscription ? new Date().toISOString() : null,
      addons: addonsData,
      addons_total_cents: financials.addonsTotalCents,
      base_price_ars: kind.isSubscription ? 0 : (data.basePriceArs ?? Math.round(financials.basePriceCents / 100)),
      vehicle_extra_ars: kind.isSubscription ? 0 : (data.vehicleExtraArs ?? Math.round(financials.vehicleExtraCents / 100)),
      extras_total_ars: data.extrasTotalArs ?? Math.round(financials.addonsTotalCents / 100),
      total_price_ars: kind.isSubscription
        ? Math.round(financials.addonsTotalCents / 100)
        : (data.totalPriceArs ?? Math.round(financials.totalPriceCents / 100)),
      booking_source: data.bookingSource || "direct",
      whatsapp_opt_in: kind.whatsappOptIn,
      barrio,
      barrio_group_key: barrioGroupKey,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    };

    const { data: booking, error: bookingError } = await supabase
      .from("bookings").insert(bookingInsertData).select().single();

    if (bookingError) {
      if (bookingError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Ese horario ya fue reservado. Elegí otro.", slotTaken: true, code: "SLOT_TAKEN" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Error al crear la reserva", details: bookingError.message, code: bookingError.code }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-booking] Booking created:", booking.id);

    // ========== 10. LOG SYSTEM EVENT ==========
    supabase.from("system_events").insert({
      event_type: "booking_created",
      entity_id: booking.id,
      payload: {
        booking_type: kind.isSubscription ? "subscription" : "single",
        payment_method: kind.paymentMethodValue,
        barrio,
        service: data.serviceName,
      },
    }).then(() => {}).catch((e: any) => console.warn("[create-booking] system_events insert error:", e));

    // ========== 11. APPLY DISCOUNT ==========
    let discountResult = null;
    try {
      const discountResp = await fetch(`${supabaseUrl}/functions/v1/apply-booking-discount`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      discountResult = await discountResp.json();
    } catch (e) { console.error("[create-booking] Discount engine error:", e); }

    // Get updated booking with discount
    const { data: updatedBooking } = await supabase
      .from("bookings")
      .select("final_price_ars, discount_type, discount_percent, discount_amount_ars, is_launch_founder_slot")
      .eq("id", booking.id).single();

    const finalPriceArs = updatedBooking?.final_price_ars || data.totalPriceArs || Math.round(financials.totalPriceCents / 100);

    // ========== 12. CREATE PAYMENT INTENT ==========
    let paymentIntent = null;
    let paymentUrl = null;

    if (!kind.isSubscription) {
      const { data: intentData, error: intentError } = await supabase
        .from("payment_intents").insert({
          booking_id: booking.id,
          type: "one_time",
          amount_ars: finalPriceArs,
          currency: "ARS",
          status: "pending",
          expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        }).select().single();

      if (!intentError && intentData) {
        paymentIntent = intentData;
        await supabase.from("bookings").update({ payment_intent_id: intentData.id }).eq("id", booking.id);
        paymentUrl = `https://washero.online/pagar/${intentData.id}`;
      }
    }

    // ========== 13. TRIGGER NOTIFICATIONS (fire & forget) ==========
    const authHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` };

    // Queue notifications
    fetch(`${supabaseUrl}/functions/v1/queue-notifications`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({
        bookingId: booking.id, isPayLater: kind.isPayLater, isTransfer: kind.isTransfer,
        isSubscription: kind.isSubscription, whatsappOptIn: data.whatsappOptIn || false,
      }),
    }).catch(e => console.error("[create-booking] Queue error:", e));

    // Admin email
    fetch(`${supabaseUrl}/functions/v1/admin-notify-booking`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({
        bookingId: booking.id, customerName: data.customerName.trim(),
        customerEmail: data.customerEmail.trim().toLowerCase(),
        customerPhone: data.customerPhone.trim(), bookingDate: data.bookingDate,
        bookingTime: data.bookingTime, address: data.address.trim(),
        serviceName: data.serviceName, vehicleSize: data.vehicleSize || data.carType,
        addons: addonsData, paymentMethod: kind.paymentMethodValue,
        paymentStatus: kind.paymentStatus,
        totalArs: data.totalPriceArs || Math.round(financials.totalPriceCents / 100),
      }),
    }).catch(e => console.error("[create-booking] Admin notify error:", e));

    // Kipper opt-in
    if (data.kipperOptIn) {
      supabase.from("kipper_leads").insert({
        customer_name: data.customerName.trim(),
        customer_email: data.customerEmail.trim().toLowerCase(),
        customer_phone: data.customerPhone.trim(),
        booking_id: booking.id, source: "booking",
        vehicle_type: data.carType || data.vehicleSize || null,
      }).then(() => {}).catch((e: any) => console.error("[create-booking] Kipper lead error:", e));
    }

    // Payment instructions for transfer
    if (kind.isTransfer && paymentIntent) {
      fetch(`${supabaseUrl}/functions/v1/send-notifications`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({
          bookingId: booking.id, messageType: "payment_instructions",
          paymentIntentId: paymentIntent.id, paymentUrl,
        }),
      }).catch(e => console.error("[create-booking] Payment instructions error:", e));
    }

    // Generate invoice for subscription bookings
    if (kind.isSubscription) {
      fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ booking_id: booking.id, type: "single", status: "paid" }),
      }).catch(e => console.error("[create-booking] Generate invoice error:", e));
    }

    // Emit notify-event
    fetch(`${supabaseUrl}/functions/v1/notify-event`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({
        event: "booking.created", timestamp: new Date().toISOString(),
        user_id: data.userId, customer_email: data.customerEmail,
        customer_phone: data.customerPhone, customer_name: data.customerName,
        booking_id: booking.id,
        amount_ars: data.totalPriceArs || Math.round(financials.totalPriceCents / 100),
        status: kind.bookingStatus,
        metadata: {
          payment_method: kind.paymentMethodValue, is_subscription: kind.isSubscription,
          is_transfer: kind.isTransfer, booking_date: data.bookingDate,
          booking_time: data.bookingTime, service_name: data.serviceName,
          barrio: data.barrio || null, address: data.address,
        },
      }),
    }).catch(e => console.error("[create-booking] Notify event error:", e));

    // Payment required event
    if (kind.isTransfer && paymentIntent) {
      fetch(`${supabaseUrl}/functions/v1/notify-event`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({
          event: "booking.payment_required", timestamp: new Date().toISOString(),
          user_id: data.userId, customer_email: data.customerEmail,
          customer_phone: data.customerPhone, customer_name: data.customerName,
          booking_id: booking.id,
          amount_ars: data.totalPriceArs || Math.round(financials.totalPriceCents / 100),
          status: "pending", metadata: { payment_url: paymentUrl },
        }),
      }).catch(e => console.error("[create-booking] Payment required event error:", e));
    }

    // ========== 14. RESPONSE ==========
    let message: string;
    if (kind.isSubscription) message = "¡Reserva confirmada con tu suscripción!";
    else if (kind.isTransfer) message = "¡Reserva recibida! Te enviamos las instrucciones de pago por email.";
    else message = "¡Reserva recibida! Te contactaremos para coordinar el pago.";

    return new Response(
      JSON.stringify({
        success: true, bookingId: booking.id, booking, paymentIntent,
        paymentIntentId: paymentIntent?.id, paymentUrl, message,
        isTransfer: kind.isTransfer, isPayLater: kind.isPayLater, isSubscription: kind.isSubscription,
        discount: updatedBooking ? {
          type: updatedBooking.discount_type, percent: updatedBooking.discount_percent,
          amount: updatedBooking.discount_amount_ars, finalPrice: updatedBooking.final_price_ars,
          isFounderSlot: updatedBooking.is_launch_founder_slot,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-booking] Error:", error);
    await logError("create-booking", "unhandled", error.message, {
      stack: error.stack, subscriptionId: data?.subscriptionId, bookingType: data?.bookingType,
    }, req);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
