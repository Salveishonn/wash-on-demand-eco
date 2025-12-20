import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    
    console.log("[mercadopago-webhook] Received webhook:", JSON.stringify(body, null, 2));

    // Handle different notification types
    if (body.type === "payment") {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        console.log("[mercadopago-webhook] No payment ID in webhook");
        return new Response("OK", { status: 200 });
      }

      console.log("[mercadopago-webhook] Fetching payment details:", paymentId);

      // Fetch payment details from MercadoPago
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            "Authorization": `Bearer ${mercadoPagoToken}`,
          },
        }
      );

      const payment = await paymentResponse.json();
      
      console.log("[mercadopago-webhook] Payment details:", JSON.stringify(payment, null, 2));

      const bookingId = payment.external_reference;
      
      if (!bookingId) {
        console.log("[mercadopago-webhook] No booking ID in payment");
        return new Response("OK", { status: 200 });
      }

      // Map MercadoPago status to our status
      let paymentStatus: string;
      let bookingStatus: string;
      
      switch (payment.status) {
        case "approved":
          paymentStatus = "approved";
          bookingStatus = "confirmed";
          break;
        case "pending":
        case "in_process":
          paymentStatus = "in_process";
          bookingStatus = "pending";
          break;
        case "rejected":
        case "cancelled":
          paymentStatus = "rejected";
          bookingStatus = "cancelled";
          break;
        case "refunded":
          paymentStatus = "refunded";
          bookingStatus = "cancelled";
          break;
        default:
          paymentStatus = "pending";
          bookingStatus = "pending";
      }

      console.log(`[mercadopago-webhook] Updating booking ${bookingId}: payment=${paymentStatus}, status=${bookingStatus}`);

      // Update booking
      const updateData: any = {
        payment_status: paymentStatus,
        status: bookingStatus,
        mercadopago_payment_id: String(paymentId),
      };

      if (paymentStatus === "approved") {
        updateData.confirmed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId);

      if (updateError) {
        console.error("[mercadopago-webhook] Error updating booking:", updateError);
        throw updateError;
      }

      console.log("[mercadopago-webhook] Booking updated successfully");

      // If payment approved, send notifications
      if (paymentStatus === "approved") {
        console.log("[mercadopago-webhook] Payment approved, triggering notifications");
        
        const notifyUrl = `${supabaseUrl}/functions/v1/send-notifications`;
        
        // Fire and forget - don't wait for response
        fetch(notifyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ bookingId }),
        }).catch(err => console.error("[mercadopago-webhook] Notification error:", err));
      }
    }

    // Handle subscription notifications
    if (body.type === "subscription_preapproval" || body.type === "subscription_authorized_payment") {
      console.log("[mercadopago-webhook] Subscription event:", body.type);
      // TODO: Handle subscription webhooks
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[mercadopago-webhook] Error:", error);
    // Always return 200 to prevent MercadoPago from retrying
    return new Response("OK", { status: 200 });
  }
});
