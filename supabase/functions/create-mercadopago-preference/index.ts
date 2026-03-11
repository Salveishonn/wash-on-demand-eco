import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError, isRateLimited } from "../_shared/securityUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Operative zones for server-side validation
const OPERATIVE_ZONES_LOWER = [
  "caba", "capital federal", "ciudad autónoma de buenos aires", "ciudad de buenos aires",
  "palermo", "belgrano", "nuñez", "colegiales", "recoleta", "retiro",
  "san telmo", "la boca", "barracas", "caballito", "flores",
  "villa crespo", "villa urquiza", "villa devoto", "chacarita", "saavedra",
  "vicente lópez", "vicente lopez", "olivos", "la lucila", "florida", "munro",
  "san isidro", "acassuso", "martínez", "martinez", "beccar", "boulogne",
  "tigre", "nordelta", "don torcuato", "general pacheco",
  "benavídez", "benavidez", "ingeniero maschwitz", "ing. maschwitz",
  "garín", "garin", "escobar", "san fernando",
];

const LAUNCH_DATE = "2026-04-15";

function isInOperativeArea(address: string): boolean {
  if (!address) return false;
  const lower = address.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\bc\d{4}\b/.test(lower)) return true;
  return OPERATIVE_ZONES_LOWER.some(zone => {
    const normalized = zone.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return lower.includes(normalized);
  });
}

function getMercadoPagoToken(): string {
  const mode = (Deno.env.get("MERCADOPAGO_MODE") || "test").toLowerCase();
  if (mode === "prod" || mode === "production") {
    return Deno.env.get("MERCADOPAGO_ACCESS_TOKEN_PROD") || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
  }
  return Deno.env.get("MERCADOPAGO_ACCESS_TOKEN_TEST") || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
}

serve(async (req) => {
  console.log("[create-mercadopago-preference] ====== FUNCTION INVOKED ======");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = getMercadoPagoToken();
  const mpMode = (Deno.env.get("MERCADOPAGO_MODE") || "test").toLowerCase();
  const isProduction = mpMode === "prod" || mpMode === "production";

  console.log("[create-mercadopago-preference] Mode:", mpMode, "Token set:", !!mercadoPagoToken);

  if (!mercadoPagoToken) {
    console.error("[create-mercadopago-preference] No MercadoPago token configured");
    return new Response(
      JSON.stringify({ error: "MercadoPago no configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limiting: max 10 payment preference requests per IP per 10 min
  const rateLimited = await isRateLimited("mp-preference", 10, 10, req);
  if (rateLimited) {
    await logError("create-mercadopago-preference", "rate_limit", "Rate limit exceeded", {}, req);
    return new Response(
      JSON.stringify({ error: "Demasiados intentos. Esperá un momento." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { type, bookingId, subscriptionId } = body;

    console.log("[create-mercadopago-preference] type:", type, "bookingId:", bookingId, "subscriptionId:", subscriptionId);

    let title = "";
    let description = "";
    let amountARS = 0;
    let customerEmail = "";
    let customerName = "";
    let externalReference = "";

    if (type === "booking" && bookingId) {
      const { data: booking, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (error || !booking) {
        await logError("create-mercadopago-preference", "booking_not_found", `Booking ${bookingId} not found`, { bookingId }, req);
        return new Response(
          JSON.stringify({ error: "Reserva no encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Validate booking date is not before launch
      if (booking.booking_date < LAUNCH_DATE) {
        await logError("create-mercadopago-preference", "blocked_date", `Payment attempt for pre-launch date ${booking.booking_date}`, { bookingId }, req);
        return new Response(
          JSON.stringify({ error: "Fecha no válida para pago" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Validate booking date is not blocked
      const { data: override } = await supabase
        .from("availability_overrides")
        .select("is_closed")
        .eq("date", booking.booking_date)
        .eq("is_closed", true)
        .maybeSingle();

      if (override) {
        await logError("create-mercadopago-preference", "blocked_date", `Payment attempt for blocked date ${booking.booking_date}`, { bookingId }, req);
        return new Response(
          JSON.stringify({ error: "Fecha bloqueada, no se puede crear el pago" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Validate address is in operative zone
      if (booking.address && !isInOperativeArea(booking.address)) {
        await logError("create-mercadopago-preference", "out_of_area", `Payment attempt for out-of-area address`, { bookingId, address: booking.address }, req);
        return new Response(
          JSON.stringify({ error: "Dirección fuera de zona operativa" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Validate booking status allows payment
      if (booking.status === "cancelled") {
        return new Response(
          JSON.stringify({ error: "Esta reserva fue cancelada" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      title = `Washero - ${booking.service_name}`;
      description = `Lavado ${booking.service_name} - ${booking.booking_date} ${booking.booking_time}`;
      
      // SECURITY: Use server-calculated price, not client-provided
      amountARS = booking.final_price_ars || booking.total_price_ars || Math.round(
        (booking.service_price_cents + (booking.car_type_extra_cents || 0) + (booking.addons_total_cents || 0)) / 100
      );
      customerEmail = booking.customer_email;
      customerName = booking.customer_name;
      externalReference = bookingId;
    } else if (type === "subscription" && subscriptionId) {
      const { data: subscription, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("id", subscriptionId)
        .single();

      if (error || !subscription) {
        return new Response(
          JSON.stringify({ error: "Suscripción no encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const plan = subscription.subscription_plans;
      title = `Washero - Suscripción ${plan?.name || "Mensual"}`;
      description = `Plan ${plan?.name || "Mensual"} - ${plan?.washes_per_month || 0} lavados/mes`;
      amountARS = plan?.price_cents ? Math.round(plan.price_cents / 100) : 0;
      customerEmail = subscription.customer_email || "";
      customerName = subscription.customer_name || "";
      externalReference = subscriptionId;
    } else {
      // Legacy format support
      if (body.bookingId && body.priceInCents) {
        externalReference = body.bookingId;
        title = body.title || "Washero - Lavado";
        description = body.description || "";
        amountARS = body.priceInCents / 100;
        customerEmail = body.customerEmail || "";
        customerName = body.customerName || "";
      } else {
        return new Response(
          JSON.stringify({ error: "Datos insuficientes" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (amountARS <= 0) {
      return new Response(
        JSON.stringify({ error: "Monto inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siteUrl = "https://washero.ar";
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    console.log("[create-mercadopago-preference] Amount ARS:", amountARS, "External ref:", externalReference);

    const preferenceData = {
      items: [
        {
          id: externalReference,
          title,
          description,
          quantity: 1,
          currency_id: "ARS",
          unit_price: amountARS,
        },
      ],
      payer: {
        email: customerEmail || undefined,
        name: customerName || undefined,
      },
      back_urls: {
        success: `${siteUrl}/pago/exito?ref=${externalReference}&type=${type || "booking"}`,
        failure: `${siteUrl}/pago/fallo?ref=${externalReference}&type=${type || "booking"}`,
        pending: `${siteUrl}/pago/pendiente?ref=${externalReference}&type=${type || "booking"}`,
      },
      auto_return: "approved",
      external_reference: externalReference,
      metadata: {
        type: type || "booking",
        bookingId: bookingId || null,
        subscriptionId: subscriptionId || null,
      },
      notification_url: webhookUrl,
      statement_descriptor: "WASHERO",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    console.log("[create-mercadopago-preference] Creating preference...");

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceData),
    });

    const mpData = await mpResponse.json();
    console.log("[create-mercadopago-preference] MP status:", mpResponse.status);

    if (!mpResponse.ok) {
      console.error("[create-mercadopago-preference] MP error:", mpData);
      await logError("create-mercadopago-preference", "mp_api_error", mpData.message || "MP API error", { status: mpResponse.status, mpData }, req);
      throw new Error(mpData.message || "Error al crear preferencia de pago");
    }

    console.log("[create-mercadopago-preference] Preference created:", mpData.id);

    // Update booking with preference ID
    if (bookingId) {
      await supabase
        .from("bookings")
        .update({ mercadopago_preference_id: mpData.id })
        .eq("id", bookingId);
    }

    const initPoint = isProduction ? mpData.init_point : (mpData.sandbox_init_point || mpData.init_point);

    return new Response(
      JSON.stringify({
        success: true,
        preferenceId: mpData.id,
        initPoint,
        sandboxInitPoint: mpData.sandbox_init_point,
        productionInitPoint: mpData.init_point,
        environment: mpMode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-mercadopago-preference] Error:", error);
    await logError("create-mercadopago-preference", "unhandled", error.message, { stack: error.stack }, req);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
