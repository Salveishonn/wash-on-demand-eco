import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePreferenceRequest {
  bookingId: string;
  title: string;
  description: string;
  priceInCents: number;
  customerEmail: string;
  customerName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

  if (!mercadoPagoToken) {
    console.error("[create-mercadopago-preference] MERCADOPAGO_ACCESS_TOKEN not configured");
    return new Response(
      JSON.stringify({ error: "MercadoPago no configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const data: CreatePreferenceRequest = await req.json();
    
    console.log("[create-mercadopago-preference] Creating preference for booking:", data.bookingId);

    // Get the site URL from environment or use default
    const siteUrl = Deno.env.get("SITE_URL") || "https://pkndizbozytnpgqxymms.lovable.app";
    
    // Create MercadoPago preference
    const preferenceData = {
      items: [
        {
          id: data.bookingId,
          title: data.title,
          description: data.description,
          quantity: 1,
          currency_id: "ARS",
          unit_price: data.priceInCents / 100, // Convert cents to ARS
        },
      ],
      payer: {
        email: data.customerEmail,
        name: data.customerName,
      },
      back_urls: {
        success: `${siteUrl}/reserva-confirmada?booking_id=${data.bookingId}`,
        failure: `${siteUrl}/reservar?error=payment_failed`,
        pending: `${siteUrl}/reserva-pendiente?booking_id=${data.bookingId}`,
      },
      auto_return: "approved",
      external_reference: data.bookingId,
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "WASHERO",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    console.log("[create-mercadopago-preference] Preference data:", JSON.stringify(preferenceData, null, 2));

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceData),
    });

    const mpData = await mpResponse.json();
    
    if (!mpResponse.ok) {
      console.error("[create-mercadopago-preference] MercadoPago error:", mpData);
      throw new Error(mpData.message || "Error al crear preferencia de pago");
    }

    console.log("[create-mercadopago-preference] Preference created:", mpData.id);

    // Update booking with preference ID
    await supabase
      .from("bookings")
      .update({ mercadopago_preference_id: mpData.id })
      .eq("id", data.bookingId);

    return new Response(
      JSON.stringify({
        success: true,
        preferenceId: mpData.id,
        initPoint: mpData.init_point,
        sandboxInitPoint: mpData.sandbox_init_point,
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
