import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateInvoicePdfBytes } from "../_shared/invoicePdf.ts";

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
  console.log("[mercadopago-webhook] ====== WEBHOOK RECEIVED ======");
  console.log("[mercadopago-webhook] Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = getMercadoPagoToken();

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse body
    let body: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const bodyText = await req.text();
      console.log("[mercadopago-webhook] Raw body:", bodyText);
      body = JSON.parse(bodyText);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const bodyText = await req.text();
      const params = new URLSearchParams(bodyText);
      body = Object.fromEntries(params.entries());
    } else {
      const url = new URL(req.url);
      body = Object.fromEntries(url.searchParams.entries());
    }

    console.log("[mercadopago-webhook] Parsed body:", JSON.stringify(body, null, 2));

    const topic = body.topic || body.type || body.action;
    const dataId = body.data?.id || body.id || body.data_id;

    console.log("[mercadopago-webhook] Topic:", topic, "Data ID:", dataId);

    // Log webhook
    await supabase.from("webhook_logs").insert({
      source: "mercadopago",
      event_type: topic,
      payload: body,
      signature_valid: true,
      processed: false,
    });

    // Handle payment notifications
    if (topic === "payment" || topic === "payment.created" || topic === "payment.updated") {
      const paymentId = dataId;
      if (!paymentId) {
        console.log("[mercadopago-webhook] No payment ID");
        return new Response("OK", { status: 200 });
      }

      console.log("[mercadopago-webhook] Fetching payment:", paymentId);

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { "Authorization": `Bearer ${mercadoPagoToken}` } }
      );

      if (!paymentResponse.ok) {
        const errorText = await paymentResponse.text();
        console.error("[mercadopago-webhook] Payment fetch error:", errorText);
        return new Response("OK", { status: 200 });
      }

      const payment = await paymentResponse.json();
      console.log("[mercadopago-webhook] Payment:", JSON.stringify({
        id: payment.id,
        status: payment.status,
        external_reference: payment.external_reference,
        transaction_amount: payment.transaction_amount,
        metadata: payment.metadata,
      }, null, 2));

      const externalRef = payment.external_reference;
      if (!externalRef) {
        console.log("[mercadopago-webhook] No external_reference");
        return new Response("OK", { status: 200 });
      }

      // Determine if this is a booking or subscription via metadata or DB lookup
      const metaType = payment.metadata?.type;
      let isBooking = true;

      if (metaType === "subscription") {
        isBooking = false;
      } else {
        // Try to find as booking first
        const { data: booking } = await supabase
          .from("bookings")
          .select("id")
          .eq("id", externalRef)
          .maybeSingle();
        
        if (!booking) {
          // Try subscription
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("id", externalRef)
            .maybeSingle();
          if (sub) isBooking = false;
        }
      }

      if (isBooking) {
        await handleBookingPayment(supabase, supabaseUrl, supabaseServiceKey, payment, externalRef, topic);
      } else {
        await handleSubscriptionPayment(supabase, payment, externalRef);
      }
    }

    // Handle merchant_order (info only)
    if (topic === "merchant_order") {
      console.log("[mercadopago-webhook] Merchant order notification (info only)");
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[mercadopago-webhook] Error:", error);
    return new Response("OK", { status: 200 });
  }
});

async function handleBookingPayment(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  payment: any,
  bookingId: string,
  topic: string
) {
  const paymentId = String(payment.id);

  // Fetch booking
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchError || !booking) {
    console.log("[mercadopago-webhook] Booking not found:", bookingId);
    return;
  }

  // Idempotency: skip if already processed
  if (booking.mercadopago_payment_id === paymentId && booking.payment_status === "approved") {
    console.log("[mercadopago-webhook] Already processed, skipping");
    return;
  }

  // Map status
  let paymentStatus: string;
  let bookingStatus: string;

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

  console.log(`[mercadopago-webhook] Updating booking ${bookingId}: payment_status=${paymentStatus}, status=${bookingStatus}`);

  const updateData: Record<string, any> = {
    payment_status: paymentStatus,
    status: bookingStatus,
    mercadopago_payment_id: paymentId,
    payment_method: "mercadopago",
    webhook_processed_at: new Date().toISOString(),
  };

  if (paymentStatus === "approved") {
    updateData.confirmed_at = new Date().toISOString();
  }

  await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId);

  console.log("[mercadopago-webhook] Booking updated");

  // If approved → generate invoice + notifications
  if (paymentStatus === "approved") {
    // Check idempotency for invoice
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (existingInvoice) {
      console.log("[mercadopago-webhook] Invoice already exists:", existingInvoice.invoice_number);
    } else {
      // Generate invoice inline (same logic as mark-booking-paid)
      try {
        const { data: invoiceNumber, error: numErr } = await supabase.rpc("generate_invoice_number");
        if (numErr || !invoiceNumber) throw new Error("Could not generate invoice number");

        const amountArs = booking.total_price_ars ||
          Math.round((booking.service_price_cents + (booking.car_type_extra_cents || 0) + (booking.addons_total_cents || 0)) / 100);

        const lineItems: { description: string; amount: number }[] = [
          { description: booking.service_name, amount: booking.base_price_ars || Math.round(booking.service_price_cents / 100) },
        ];
        if ((booking.vehicle_extra_ars || 0) > 0) {
          lineItems.push({ description: `Extra vehículo (${booking.vehicle_size || booking.car_type})`, amount: booking.vehicle_extra_ars });
        }
        if (booking.addons && Array.isArray(booking.addons)) {
          for (const addon of booking.addons as any[]) {
            lineItems.push({ description: addon.name, amount: addon.price_ars || Math.round((addon.price_cents || 0) / 100) });
          }
        }

        // Create invoice row
        const { data: invoice, error: insertErr } = await supabase.from("invoices").insert({
          user_id: booking.user_id,
          booking_id: bookingId,
          invoice_number: invoiceNumber,
          status: "paid",
          amount_ars: amountArs,
          paid_at: new Date().toISOString(),
          metadata: {
            booking_id: bookingId,
            service: booking.service_name,
            line_items: lineItems,
            payment_provider: "mercadopago",
            payment_id: paymentId,
          },
        }).select().single();

        if (insertErr) throw new Error(`Invoice insert error: ${insertErr.message}`);

        console.log("[mercadopago-webhook] Invoice created:", invoiceNumber);

        // Generate PDF
        const formatDate = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const pdfBytes = await generateInvoicePdfBytes({
          invoiceNumber,
          date: formatDate(new Date()),
          status: "paid",
          customerName: booking.customer_name,
          customerEmail: booking.customer_email,
          customerPhone: booking.customer_phone,
          lineItems,
          totalAmount: amountArs,
        });

        const pdfFileName = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
        const pdfPath = `${invoice.id}/${pdfFileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("invoices")
          .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });

        let pdfUrl: string | null = null;
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(pdfPath);
          pdfUrl = urlData?.publicUrl || null;
          await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoice.id);
          console.log("[mercadopago-webhook] PDF uploaded:", pdfUrl);
        } else {
          console.error("[mercadopago-webhook] PDF upload error:", uploadErr);
        }

        // Send email via Resend
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "Washero <info@washero.ar>";
        const formatPrice = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

        if (resendApiKey && booking.customer_email) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: resendFrom,
                to: [booking.customer_email],
                cc: ["info@washero.ar"],
                subject: `Tu factura Washero 🧼✨ - ${invoiceNumber}`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <div style="background:linear-gradient(135deg,#1a1a1a,#333);color:#FFD700;padding:30px;text-align:center;border-radius:10px 10px 0 0">
                    <h1 style="margin:0;font-size:22px">🧼 Tu Factura Washero</h1>
                  </div>
                  <div style="background:white;padding:30px">
                    <p>Hola <strong>${booking.customer_name}</strong>,</p>
                    <p>Tu pago por MercadoPago fue confirmado. Adjuntamos tu factura <strong>${invoiceNumber}</strong> por <strong>${formatPrice(amountArs)}</strong>.</p>
                    <div style="background:#FFF8E1;border:2px solid #FFD700;border-radius:10px;padding:20px;text-align:center;margin:20px 0">
                      <div style="font-size:20px;font-weight:bold">${invoiceNumber}</div>
                      <div style="font-size:32px;font-weight:bold;margin:10px 0">${formatPrice(amountArs)}</div>
                      <span style="background:#dcfce7;color:#166534;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600">PAGADO</span>
                    </div>
                    ${pdfUrl ? `<div style="text-align:center;margin:25px 0">
                      <a href="${pdfUrl}" style="display:inline-block;background:#FFD700;color:#1a1a1a;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700" target="_blank">📄 Ver Factura (PDF)</a>
                    </div>` : ""}
                  </div>
                  <div style="text-align:center;padding:20px;color:#999;font-size:12px">
                    <p>WASHERO - Lavado de autos a domicilio</p>
                    <p>washero.ar | info@washero.ar</p>
                  </div>
                </div>`,
              }),
            });
            console.log("[mercadopago-webhook] Email sent to:", booking.customer_email);
          } catch (emailErr) {
            console.error("[mercadopago-webhook] Email error:", emailErr);
          }
        }
      } catch (invoiceErr) {
        console.error("[mercadopago-webhook] Invoice generation error:", invoiceErr);
      }
    }

    // Queue notifications
    const queueUrl = `${supabaseUrl}/functions/v1/queue-notifications`;
    try {
      await fetch(queueUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ bookingId }),
      });
    } catch (queueErr) {
      console.error("[mercadopago-webhook] Queue error:", queueErr);
    }
  }

  // Mark webhook as processed
  await supabase
    .from("webhook_logs")
    .update({ processed: true })
    .eq("source", "mercadopago")
    .eq("event_type", topic);
}

async function handleSubscriptionPayment(
  supabase: any,
  payment: any,
  subscriptionId: string
) {
  if (payment.status !== "approved") {
    console.log("[mercadopago-webhook] Subscription payment not approved:", payment.status);
    return;
  }

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("*, subscription_plans(*)")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error || !subscription) {
    console.log("[mercadopago-webhook] Subscription not found:", subscriptionId);
    return;
  }

  // Update subscription to active + paid
  const washesPerMonth = subscription.subscription_plans?.washes_per_month || 0;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      washes_remaining: washesPerMonth,
      washes_used_in_cycle: 0,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .eq("id", subscriptionId);

  console.log("[mercadopago-webhook] Subscription activated:", subscriptionId);

  // Log event
  await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    event_type: "payment_approved_mercadopago",
    payload: { payment_id: payment.id, amount: payment.transaction_amount },
    processed: true,
  });
}
