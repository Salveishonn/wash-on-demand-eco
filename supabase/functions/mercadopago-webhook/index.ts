import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple rate limiting (in-memory, resets on cold start)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60000;

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
  console.log("[mercadopago-webhook] ====== WEBHOOK RECEIVED ======");
  console.log("[mercadopago-webhook] Method:", req.method);
  console.log("[mercadopago-webhook] URL:", req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  console.log("[mercadopago-webhook] Client IP:", clientIp);
  
  if (!checkRateLimit(clientIp)) {
    console.warn("[mercadopago-webhook] Rate limited:", clientIp);
    return new Response("Too Many Requests", { status: 429 });
  }

  try {
    // Parse body - handle both JSON and form-urlencoded
    let body: any;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const bodyText = await req.text();
      console.log("[mercadopago-webhook] Raw body:", bodyText);
      body = JSON.parse(bodyText);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const bodyText = await req.text();
      console.log("[mercadopago-webhook] Form body:", bodyText);
      const params = new URLSearchParams(bodyText);
      body = Object.fromEntries(params.entries());
    } else {
      // Try URL query params (MercadoPago sometimes sends via GET)
      const url = new URL(req.url);
      body = Object.fromEntries(url.searchParams.entries());
      console.log("[mercadopago-webhook] Query params body:", body);
    }
    
    console.log("[mercadopago-webhook] Parsed body:", JSON.stringify(body, null, 2));

    // Extract topic and id from various formats
    const topic = body.topic || body.type || body.action;
    const dataId = body.data?.id || body.id || body.data_id;
    
    console.log("[mercadopago-webhook] Topic:", topic);
    console.log("[mercadopago-webhook] Data ID:", dataId);

    // Log webhook for debugging
    await supabase.from("webhook_logs").insert({
      source: "mercadopago",
      event_type: topic,
      payload: body,
      signature_valid: true,
      processed: false,
    });

    // Handle different notification types
    if (topic === "payment" || topic === "payment.created" || topic === "payment.updated") {
      const paymentId = dataId;
      
      if (!paymentId) {
        console.log("[mercadopago-webhook] No payment ID found");
        return new Response("OK", { status: 200 });
      }

      console.log("[mercadopago-webhook] Fetching payment:", paymentId);

      // Fetch payment details from MercadoPago
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: { "Authorization": `Bearer ${mercadoPagoToken}` },
        }
      );

      console.log("[mercadopago-webhook] Payment API response status:", paymentResponse.status);

      if (!paymentResponse.ok) {
        const errorText = await paymentResponse.text();
        console.error("[mercadopago-webhook] Payment fetch error:", errorText);
        return new Response("OK", { status: 200 });
      }

      const payment = await paymentResponse.json();
      console.log("[mercadopago-webhook] Payment details:", JSON.stringify({
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        external_reference: payment.external_reference,
        transaction_amount: payment.transaction_amount,
      }, null, 2));

      const bookingId = payment.external_reference;
      
      if (!bookingId) {
        console.log("[mercadopago-webhook] No booking ID in external_reference");
        return new Response("OK", { status: 200 });
      }

      // Check if already processed (idempotency)
      const { data: existingBooking, error: fetchError } = await supabase
        .from("bookings")
        .select("id, status, payment_status, mercadopago_payment_id, webhook_processed_at")
        .eq("id", bookingId)
        .maybeSingle();

      if (fetchError) {
        console.error("[mercadopago-webhook] Booking fetch error:", fetchError);
        return new Response("OK", { status: 200 });
      }

      if (!existingBooking) {
        console.log("[mercadopago-webhook] Booking not found:", bookingId);
        return new Response("OK", { status: 200 });
      }

      console.log("[mercadopago-webhook] Existing booking:", JSON.stringify(existingBooking, null, 2));

      // Skip if already processed with same payment ID and approved status
      if (existingBooking.mercadopago_payment_id === String(paymentId) && 
          existingBooking.payment_status === "approved") {
        console.log("[mercadopago-webhook] Already processed payment, skipping");
        
        await supabase
          .from("webhook_logs")
          .update({ processed: true })
          .eq("source", "mercadopago")
          .eq("payload->data->id", paymentId);
          
        return new Response("OK", { status: 200 });
      }

      // Map MercadoPago status to our status
      let paymentStatus: 'pending' | 'approved' | 'rejected' | 'in_process' | 'refunded';
      let bookingStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed';
      
      switch (payment.status) {
        case "approved":
          paymentStatus = "approved";
          bookingStatus = "confirmed";
          break;
        case "pending":
        case "in_process":
        case "authorized":
          paymentStatus = "in_process";
          bookingStatus = "pending";
          break;
        case "rejected":
        case "cancelled":
          paymentStatus = "rejected";
          bookingStatus = "cancelled";
          break;
        case "refunded":
        case "charged_back":
          paymentStatus = "refunded";
          bookingStatus = "cancelled";
          break;
        default:
          paymentStatus = "pending";
          bookingStatus = "pending";
      }

      console.log(`[mercadopago-webhook] Updating booking ${bookingId}:`);
      console.log(`  - payment_status: ${paymentStatus}`);
      console.log(`  - booking_status: ${bookingStatus}`);

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

      console.log("[mercadopago-webhook] Booking updated successfully");

      // Mark webhook as processed
      await supabase
        .from("webhook_logs")
        .update({ processed: true })
        .eq("source", "mercadopago")
        .eq("event_type", topic);

      // If payment approved, queue notifications
      if (paymentStatus === "approved") {
        console.log("[mercadopago-webhook] Payment approved, queueing notifications");
        
        const queueUrl = `${supabaseUrl}/functions/v1/queue-notifications`;
        
        try {
          const queueResponse = await fetch(queueUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ bookingId }),
          });
          
          console.log("[mercadopago-webhook] Queue response:", queueResponse.status);
        } catch (queueErr) {
          console.error("[mercadopago-webhook] Queue error:", queueErr);
        }
      }
    }

    // Handle merchant_order notifications (optional, for tracking)
    if (topic === "merchant_order") {
      console.log("[mercadopago-webhook] Merchant order notification received (info only)");
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[mercadopago-webhook] Error:", error);
    // Always return 200 to prevent MercadoPago retries
    return new Response("OK", { status: 200 });
  }
});
