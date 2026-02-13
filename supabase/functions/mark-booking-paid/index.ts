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
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleData) {
          return new Response(JSON.stringify({ success: false, error: "No autorizado" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { bookingId } = await req.json();
    if (!bookingId) {
      return new Response(JSON.stringify({ success: false, error: "bookingId requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[mark-booking-paid] Processing:", bookingId);

    // 1. Fetch booking
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ success: false, error: "Reserva no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check idempotency — if already paid and invoice exists, return existing
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (existingInvoice) {
      console.log("[mark-booking-paid] Invoice already exists:", existingInvoice.invoice_number);
      // Make sure booking is marked paid too
      if (booking.payment_status !== "approved") {
        await supabase.from("bookings").update({
          payment_status: "approved",
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        }).eq("id", bookingId);
      }
      return new Response(JSON.stringify({
        success: true,
        invoice: existingInvoice,
        message: `Factura ${existingInvoice.invoice_number} ya existente`,
        duplicate: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Mark booking as paid
    const { error: updateErr } = await supabase
      .from("bookings")
      .update({
        payment_status: "approved",
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateErr) {
      console.error("[mark-booking-paid] Update error:", updateErr);
      throw new Error("No se pudo actualizar la reserva");
    }

    // 4. Generate invoice number
    const { data: invoiceNumber, error: numErr } = await supabase.rpc("generate_invoice_number");
    if (numErr || !invoiceNumber) {
      throw new Error("No se pudo generar número de factura");
    }

    console.log("[mark-booking-paid] Invoice number:", invoiceNumber);

    // 5. Calculate amounts
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

    // 6. Create invoice row
    const { data: invoice, error: insertErr } = await supabase
      .from("invoices")
      .insert({
        user_id: booking.user_id,
        booking_id: bookingId,
        invoice_number: invoiceNumber,
        status: "paid",
        amount_ars: amountArs,
        paid_at: new Date().toISOString(),
        metadata: { booking_id: bookingId, service: booking.service_name, line_items: lineItems },
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[mark-booking-paid] Invoice insert error:", insertErr);
      throw new Error(`Error creando factura: ${insertErr.message}`);
    }

    // 7. Generate PDF HTML
    const formatPrice = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
    const formatDate = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const itemsHtml = lineItems.map(item => `
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.amount)}</td></tr>
    `).join("");

    const pdfHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;margin:0;padding:40px;background:#fff}
.header{display:flex;justify-content:space-between;margin-bottom:40px}
.logo{font-size:24px;font-weight:bold;color:#7ed957}
.invoice-info{text-align:right}.invoice-number{font-size:18px;font-weight:bold;margin-bottom:8px}
.customer-info{margin-bottom:30px;padding:20px;background:#f9fafb;border-radius:8px}
.items-table{width:100%;border-collapse:collapse;margin-bottom:30px}
.items-table th{padding:12px 8px;background:#f3f4f6;text-align:left;font-weight:600}
.items-table th:last-child{text-align:right}
.total-row{font-weight:bold;font-size:18px}.total-row td{padding-top:16px;border-top:2px solid #333}
.status{display:inline-block;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;background:#dcfce7;color:#166534}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#666;text-align:center}</style></head>
<body>
<div class="header"><div class="logo">🚿 WASHERO</div>
<div class="invoice-info"><div class="invoice-number">${invoiceNumber}</div>
<div>Fecha: ${formatDate(new Date())}</div>
<div style="margin-top:8px"><span class="status">PAGADO</span></div></div></div>
<div class="customer-info"><h3 style="margin:0 0 10px;font-size:14px;color:#666">CLIENTE</h3>
<div><strong>${booking.customer_name}</strong></div>
<div>${booking.customer_email}</div><div>${booking.customer_phone}</div></div>
<table class="items-table"><thead><tr><th>Descripción</th><th>Monto</th></tr></thead>
<tbody>${itemsHtml}
<tr class="total-row"><td style="padding:16px 8px">TOTAL</td>
<td style="padding:16px 8px;text-align:right">${formatPrice(amountArs)}</td></tr></tbody></table>
<div class="footer"><p>WASHERO - Lavado de autos a domicilio</p>
<p>www.washero.online | contacto@washero.online</p></div></body></html>`;

    // 8. Upload PDF to storage
    const pdfFileName = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "-")}.html`;
    const pdfPath = `${invoice.id}/${pdfFileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("invoices")
      .upload(pdfPath, pdfHtml, { contentType: "text/html", upsert: true });

    let pdfUrl: string | null = null;
    if (uploadErr) {
      console.error("[mark-booking-paid] Upload error:", uploadErr);
    } else {
      const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(pdfPath);
      pdfUrl = urlData?.publicUrl || null;
      await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoice.id);
    }

    // 9. Send email (best-effort, don't block)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "Washero <reservas@washero.online>";
    if (resendApiKey && booking.customer_email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: resendFrom,
            to: [booking.customer_email],
            cc: ["washerocarwash@gmail.com"],
            subject: `Tu factura Washero 🧼✨ - ${invoiceNumber}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#FFD700">🧼 Tu Factura Washero</h2>
              <p>Hola <strong>${booking.customer_name}</strong>,</p>
              <p>Tu pago fue registrado. Adjuntamos tu factura <strong>${invoiceNumber}</strong> por <strong>${formatPrice(amountArs)}</strong>.</p>
              ${pdfUrl ? `<p><a href="${pdfUrl}" style="display:inline-block;background:#FFD700;color:#1a1a1a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">📄 Ver Factura</a></p>` : ""}
              <p style="color:#999;font-size:12px;margin-top:30px">WASHERO - www.washero.online</p></div>`,
          }),
        });
      } catch (emailErr) {
        console.error("[mark-booking-paid] Email error:", emailErr);
      }
    }

    console.log("[mark-booking-paid] Success:", invoiceNumber);

    return new Response(JSON.stringify({
      success: true,
      invoice: { ...invoice, pdf_url: pdfUrl },
      message: `Factura ${invoiceNumber} generada`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[mark-booking-paid] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
