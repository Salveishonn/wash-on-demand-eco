import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateInvoicePdfBytes } from "../_shared/invoicePdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateInvoiceRequest {
  booking_id?: string;
  subscription_id?: string;
  type: "single" | "subscription";
  status?: "pending_payment" | "paid";
  resend?: boolean;
  existing_invoice_id?: string;
}

const formatPrice = (amount: number): string =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(amount);

const formatDate = (date: Date): string =>
  date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const data: GenerateInvoiceRequest = await req.json();
    console.log("[generate-invoice] Request:", data);

    // If resending an existing invoice, just send the email
    if (data.resend && data.existing_invoice_id) {
      const { data: existingInv, error: invErr } = await supabase
        .from("invoices").select("*").eq("id", data.existing_invoice_id).single();
      if (invErr || !existingInv) throw new Error("Factura no encontrada");

      // Determine customer info from linked booking or subscription
      let customerEmail = "";
      let customerName = "";
      if (existingInv.booking_id) {
        const { data: b } = await supabase.from("bookings").select("customer_email, customer_name").eq("id", existingInv.booking_id).single();
        if (b) { customerEmail = b.customer_email; customerName = b.customer_name; }
      } else if (existingInv.subscription_id) {
        const { data: s } = await supabase.from("subscriptions").select("customer_email, customer_name").eq("id", existingInv.subscription_id).single();
        if (s) { customerEmail = s.customer_email || ""; customerName = s.customer_name || ""; }
      }

      if (customerEmail) {
        await sendInvoiceEmail({
          resendApiKey: Deno.env.get("RESEND_API_KEY") || "",
          resendFrom: Deno.env.get("RESEND_FROM_EMAIL") || "Washero <info@washero.ar>",
          to: customerEmail,
          customerName,
          invoiceNumber: existingInv.invoice_number,
          amountArs: existingInv.amount_ars,
          status: existingInv.status,
          pdfUrl: existingInv.pdf_url,
        });
      }

      return new Response(JSON.stringify({ success: true, invoice: existingInv, message: "Email reenviado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string | null = null;
    let amountArs = 0;
    let customerName = "";
    let customerEmail = "";
    let customerPhone = "";
    let lineItems: { description: string; amount: number }[] = [];
    let metadata: Record<string, unknown> = {};

    if (data.type === "single" && data.booking_id) {
      const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", data.booking_id).single();
      if (error || !booking) throw new Error("Reserva no encontrada");

      userId = booking.user_id;
      amountArs = booking.total_price_ars || Math.round((booking.service_price_cents + (booking.car_type_extra_cents || 0) + (booking.addons_total_cents || 0)) / 100);
      customerName = booking.customer_name;
      customerEmail = booking.customer_email;
      customerPhone = booking.customer_phone;
      lineItems = [{ description: booking.service_name, amount: booking.base_price_ars || Math.round(booking.service_price_cents / 100) }];
      if (booking.vehicle_extra_ars > 0) lineItems.push({ description: `Extra vehículo (${booking.vehicle_size || booking.car_type})`, amount: booking.vehicle_extra_ars });
      if (booking.addons && Array.isArray(booking.addons)) {
        for (const addon of booking.addons as any[]) {
          lineItems.push({ description: addon.name, amount: addon.price_ars || Math.round((addon.price_cents || 0) / 100) });
        }
      }
      metadata = { booking_id: data.booking_id, service: booking.service_name };
    } else if (data.type === "subscription" && data.subscription_id) {
      const { data: subscription, error } = await supabase.from("subscriptions").select("*, subscription_plans(*)").eq("id", data.subscription_id).single();
      if (error || !subscription) throw new Error("Suscripción no encontrada");

      userId = subscription.user_id;
      amountArs = subscription.subscription_plans?.price_cents ? Math.round(subscription.subscription_plans.price_cents / 100) : 0;
      customerName = subscription.customer_name || "";
      customerEmail = subscription.customer_email || "";
      customerPhone = subscription.customer_phone || "";
      lineItems = [{ description: `Suscripción ${subscription.subscription_plans?.name || subscription.plan_code}`, amount: amountArs }];
      metadata = { subscription_id: data.subscription_id, plan: subscription.plan_code };
    } else {
      throw new Error("Debe proveer booking_id o subscription_id");
    }

    // Generate invoice number
    const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
    if (!invoiceNumber) throw new Error("No se pudo generar número de factura");

    const invoiceStatus = data.status || "pending_payment";

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      user_id: userId,
      booking_id: data.booking_id || null,
      subscription_id: data.subscription_id || null,
      invoice_number: invoiceNumber,
      status: invoiceStatus,
      amount_ars: amountArs,
      paid_at: invoiceStatus === "paid" ? new Date().toISOString() : null,
      metadata,
    }).select().single();

    if (invoiceError) throw new Error(`Error creando factura: ${invoiceError.message}`);

    // Generate real PDF
    const pdfBytes = await generateInvoicePdfBytes({
      invoiceNumber,
      date: formatDate(new Date(invoice.issued_at)),
      status: invoiceStatus,
      customerName,
      customerEmail,
      customerPhone,
      lineItems,
      totalAmount: amountArs,
    });

    // Upload PDF
    const pdfFileName = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
    const pdfPath = `${invoice.id}/${pdfFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("[generate-invoice] Upload error:", uploadError);
    } else {
      const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(pdfPath);
      if (urlData?.publicUrl) {
        await supabase.from("invoices").update({ pdf_url: urlData.publicUrl }).eq("id", invoice.id);
        invoice.pdf_url = urlData.publicUrl;
      }
    }

    // Send email
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && customerEmail) {
      await sendInvoiceEmail({
        resendApiKey,
        resendFrom: Deno.env.get("RESEND_FROM_EMAIL") || "Washero <info@washero.ar>",
        to: customerEmail,
        customerName,
        invoiceNumber,
        amountArs,
        status: invoiceStatus,
        pdfUrl: invoice.pdf_url,
      });
    }

    // Emit event (fire-and-forget)
    fetch(`${supabaseUrl}/functions/v1/notify-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        event: "invoice.created", timestamp: new Date().toISOString(),
        user_id: userId, customer_email: customerEmail, customer_phone: customerPhone,
        customer_name: customerName, invoice_id: invoice.id,
        booking_id: data.booking_id, subscription_id: data.subscription_id,
        amount_ars: amountArs, status: invoiceStatus,
        metadata: { invoice_number: invoiceNumber, pdf_url: invoice.pdf_url },
      }),
    }).catch(err => console.error("[generate-invoice] Notify error:", err));

    return new Response(JSON.stringify({ success: true, invoice, message: `Factura ${invoiceNumber} generada` }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[generate-invoice] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendInvoiceEmail(opts: {
  resendApiKey: string; resendFrom: string; to: string;
  customerName: string; invoiceNumber: string; amountArs: number;
  status: string; pdfUrl: string | null;
}) {
  try {
    const statusLabel = opts.status === "paid" ? "PAGADO" : "PENDIENTE DE PAGO";
    const statusColor = opts.status === "paid" ? "background:#dcfce7;color:#166534" : "background:#fef3c7;color:#92400e";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: opts.resendFrom,
        to: [opts.to],
        cc: ["info@washero.ar"],
        subject: `Tu factura Washero 🧼✨ - ${opts.invoiceNumber}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#1a1a1a,#333);color:#FFD700;padding:30px;text-align:center;border-radius:10px 10px 0 0">
            <h1 style="margin:0;font-size:22px">🧼 Tu Factura Washero</h1>
          </div>
          <div style="background:white;padding:30px">
            <p>Hola <strong>${opts.customerName || "Cliente"}</strong>,</p>
            <p>Adjuntamos tu factura <strong>${opts.invoiceNumber}</strong> por <strong>${formatPrice(opts.amountArs)}</strong>.</p>
            <div style="background:#FFF8E1;border:2px solid #FFD700;border-radius:10px;padding:20px;text-align:center;margin:20px 0">
              <div style="font-size:20px;font-weight:bold">${opts.invoiceNumber}</div>
              <div style="font-size:32px;font-weight:bold;margin:10px 0">${formatPrice(opts.amountArs)}</div>
              <span style="${statusColor};padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600">${statusLabel}</span>
            </div>
            ${opts.pdfUrl ? `<div style="text-align:center;margin:25px 0">
              <a href="${opts.pdfUrl}" style="display:inline-block;background:#FFD700;color:#1a1a1a;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700" target="_blank">📄 Ver Factura (PDF)</a>
            </div>` : ""}
          </div>
          <div style="text-align:center;padding:20px;color:#999;font-size:12px">
            <p>WASHERO - Lavado de autos a domicilio</p>
            <p>washero.ar | info@washero.ar</p>
          </div>
        </div>`,
      }),
    });
  } catch (err) {
    console.error("[generate-invoice] Email error:", err);
  }
}
