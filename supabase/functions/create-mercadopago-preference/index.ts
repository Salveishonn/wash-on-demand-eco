import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        return new Response(
          JSON.stringify({ error: "Reserva no encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      title = `Washero - ${booking.service_name}`;
      description = `Lavado ${booking.service_name} - ${booking.booking_date} ${booking.booking_time}`;
      amountARS = booking.total_price_ars || Math.round(
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
