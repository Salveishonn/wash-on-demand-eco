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
  console.log("[create-mercadopago-preference] ====== FUNCTION INVOKED ======");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const mpEnv = Deno.env.get("MERCADOPAGO_ENV") || "sandbox";

  console.log("[create-mercadopago-preference] Environment:", mpEnv);
  console.log("[create-mercadopago-preference] MP Token set:", !!mercadoPagoToken);

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
    
    console.log("[create-mercadopago-preference] Request data:", JSON.stringify(data, null, 2));
    console.log("[create-mercadopago-preference] Creating preference for booking:", data.bookingId);

    // Production site URL - always use washero.online
    const siteUrl = "https://washero.online";
    
    // Webhook URL - uses Supabase edge function
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
    
    console.log("[create-mercadopago-preference] Site URL:", siteUrl);
    console.log("[create-mercadopago-preference] Webhook URL:", webhookUrl);

    // Convert cents to ARS (divide by 100)
    const amountARS = data.priceInCents / 100;
    
    console.log("[create-mercadopago-preference] Amount in cents:", data.priceInCents);
    console.log("[create-mercadopago-preference] Amount in ARS:", amountARS);

    // Create MercadoPago preference
    const preferenceData = {
      items: [
        {
          id: data.bookingId,
          title: data.title,
          description: data.description,
          quantity: 1,
          currency_id: "ARS",
          unit_price: amountARS,
        },
      ],
      payer: {
        email: data.customerEmail,
        name: data.customerName,
      },
      back_urls: {
        success: `${siteUrl}/reserva-confirmada?booking_id=${data.bookingId}&payment_method=online`,
        failure: `${siteUrl}/reservar?error=payment_failed`,
        pending: `${siteUrl}/reserva-confirmada?booking_id=${data.bookingId}&payment_method=online&status=pending`,
      },
      auto_return: "approved",
      external_reference: data.bookingId,
      notification_url: webhookUrl,
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
    
    console.log("[create-mercadopago-preference] MP Response status:", mpResponse.status);
    console.log("[create-mercadopago-preference] MP Response:", JSON.stringify(mpData, null, 2));
    
    if (!mpResponse.ok) {
      console.error("[create-mercadopago-preference] MercadoPago error:", mpData);
      throw new Error(mpData.message || "Error al crear preferencia de pago");
    }

    console.log("[create-mercadopago-preference] Preference created:", mpData.id);

    // Update booking with preference ID
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ mercadopago_preference_id: mpData.id })
      .eq("id", data.bookingId);

    if (updateError) {
      console.error("[create-mercadopago-preference] Error updating booking:", updateError);
    }

    // Return the appropriate init_point based on environment
    const initPoint = mpEnv === "production" ? mpData.init_point : mpData.sandbox_init_point;
    
    console.log("[create-mercadopago-preference] Using init_point:", initPoint);
    console.log("[create-mercadopago-preference] sandbox_init_point:", mpData.sandbox_init_point);
    console.log("[create-mercadopago-preference] production init_point:", mpData.init_point);

    return new Response(
      JSON.stringify({
        success: true,
        preferenceId: mpData.id,
        initPoint: initPoint || mpData.init_point, // Fallback to production URL
        sandboxInitPoint: mpData.sandbox_init_point,
        environment: mpEnv,
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
