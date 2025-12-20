import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple rate limiting (in-memory, resets on cold start)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per window
const RATE_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  if (!checkRateLimit(clientIp)) {
    console.warn(`[mercadopago-webhook] Rate limited: ${clientIp}`);
    return new Response("Too Many Requests", { status: 429 });
  }

  try {
    const bodyText = await req.text();
    let body: any;
    
    try {
      body = JSON.parse(bodyText);
    } catch {
      console.error("[mercadopago-webhook] Invalid JSON body");
      return new Response("Bad Request", { status: 400 });
    }
    
    console.log("[mercadopago-webhook] Received webhook:", JSON.stringify(body, null, 2));

    // Log webhook for debugging
    await supabase.from("webhook_logs").insert({
      source: "mercadopago",
      event_type: body.type || body.action,
      payload: body,
      signature_valid: true, // MercadoPago uses IP allowlist, not signature
      processed: false,
    });

    // Validate required fields
    if (!body.type && !body.action) {
      console.log("[mercadopago-webhook] No type/action in webhook");
      return new Response("OK", { status: 200 });
    }

    // Handle payment notifications
    if (body.type === "payment" || body.action === "payment.created" || body.action === "payment.updated") {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        console.log("[mercadopago-webhook] No payment ID");
        return new Response("OK", { status: 200 });
      }

      console.log("[mercadopago-webhook] Fetching payment:", paymentId);

      // Fetch payment details from MercadoPago (this validates the payment exists)
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: { "Authorization": `Bearer ${mercadoPagoToken}` },
        }
      );

      if (!paymentResponse.ok) {
        console.error("[mercadopago-webhook] Invalid payment ID");
        return new Response("OK", { status: 200 });
      }

      const payment = await paymentResponse.json();
      console.log("[mercadopago-webhook] Payment status:", payment.status);

      const bookingId = payment.external_reference;
      
      if (!bookingId) {
        console.log("[mercadopago-webhook] No booking ID in external_reference");
        return new Response("OK", { status: 200 });
      }

      // Check if already processed (idempotency)
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id, status, payment_status, webhook_processed_at")
        .eq("id", bookingId)
        .maybeSingle();

      if (!existingBooking) {
        console.log("[mercadopago-webhook] Booking not found:", bookingId);
        return new Response("OK", { status: 200 });
      }

      // Skip if already processed with same or better status
      if (existingBooking.payment_status === "approved" && payment.status === "approved") {
        console.log("[mercadopago-webhook] Already processed as approved, skipping");
        
        // Update webhook log
        await supabase
          .from("webhook_logs")
          .update({ processed: true })
          .eq("payload->data->id", paymentId);
          
        return new Response("OK", { status: 200 });
      }

      // Map MercadoPago status
      let paymentStatus: 'pending' | 'approved' | 'rejected' | 'in_process' | 'refunded';
      let bookingStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed';
      
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
      const updateData: Record<string, any> = {
        payment_status: paymentStatus,
        status: bookingStatus,
        mercadopago_payment_id: String(paymentId),
        webhook_processed_at: new Date().toISOString(),
      };

      if (paymentStatus === "approved") {
        updateData.confirmed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId);

      if (updateError) {
        console.error("[mercadopago-webhook] Update error:", updateError);
        throw updateError;
      }

      // Update webhook log
      await supabase
        .from("webhook_logs")
        .update({ processed: true })
        .eq("payload->data->id", paymentId);

      // If payment approved, queue notifications
      if (paymentStatus === "approved") {
        console.log("[mercadopago-webhook] Payment approved, queueing notifications");
        
        const queueUrl = `${supabaseUrl}/functions/v1/queue-notifications`;
        
        fetch(queueUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ bookingId }),
        }).catch(err => console.error("[mercadopago-webhook] Queue error:", err));
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[mercadopago-webhook] Error:", error);
    // Always return 200 to prevent MercadoPago retries that we can't handle
    return new Response("OK", { status: 200 });
  }
});
