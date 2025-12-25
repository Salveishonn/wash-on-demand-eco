import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentIntentRequest {
  bookingId?: string;
  subscriptionId?: string;
  type: "one_time" | "subscription_monthly";
  amountArs: number;
  expiresInHours?: number;
}

serve(async (req) => {
  console.log("[create-payment-intent] ====== FUNCTION INVOKED ======");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const data: CreatePaymentIntentRequest = await req.json();
    
    console.log("[create-payment-intent] Request:", JSON.stringify(data));

    // Validate
    if (!data.amountArs || data.amountArs <= 0) {
      throw new Error("Monto inválido");
    }

    if (!data.type) {
      throw new Error("Tipo de pago requerido");
    }

    // Calculate expiration (default 72 hours for one-time, 30 days for subscription)
    let expiresAt: string | null = null;
    if (data.expiresInHours) {
      expiresAt = new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000).toISOString();
    } else if (data.type === "one_time") {
      expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours
    } else {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    }

    // Create payment intent
    const { data: paymentIntent, error: insertError } = await supabase
      .from("payment_intents")
      .insert({
        booking_id: data.bookingId || null,
        subscription_id: data.subscriptionId || null,
        type: data.type,
        amount_ars: data.amountArs,
        currency: "ARS",
        status: "pending",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[create-payment-intent] Insert error:", insertError);
      throw new Error("Error al crear el intent de pago");
    }

    console.log("[create-payment-intent] Created payment intent:", paymentIntent.id);

    // If linked to a booking, update the booking with the payment_intent_id
    if (data.bookingId) {
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ payment_intent_id: paymentIntent.id })
        .eq("id", data.bookingId);

      if (updateError) {
        console.error("[create-payment-intent] Booking update error:", updateError);
        // Non-fatal, continue
      }
    }

    // Generate payment URL
    const baseUrl = Deno.env.get("SITE_URL") || "https://washero.online";
    const paymentUrl = `${baseUrl}/pagar/${paymentIntent.id}`;

    return new Response(
      JSON.stringify({
        success: true,
        paymentIntent,
        paymentUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-payment-intent] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});