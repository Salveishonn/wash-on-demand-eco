import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateInvoicePdfBytes } from "../_shared/invoicePdf.ts";

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
          .from("user_roles").select("role")
          .eq("user_id", user.id).eq("role", "admin").maybeSingle();
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
      .from("bookings").select("*").eq("id", bookingId).single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ success: false, error: "Reserva no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Idempotency — if invoice already exists, return it
    const { data: existingInvoice } = await supabase
      .from("invoices").select("*").eq("booking_id", bookingId).maybeSingle();

    if (existingInvoice) {
      console.log("[mark-booking-paid] Invoice already exists:", existingInvoice.invoice_number);
      if (booking.payment_status !== "approved") {
        await supabase.from("bookings").update({
          payment_status: "approved", status: "confirmed",
          confirmed_at: new Date().toISOString(),
        }).eq("id", bookingId);
      }
      return new Response(JSON.stringify({
        success: true, invoice: existingInvoice,
        message: `Factura ${existingInvoice.invoice_number} ya existente`, duplicate: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Mark booking as paid
    await supabase.from("bookings").update({
      payment_status: "approved", status: "confirmed",
      confirmed_at: new Date().toISOString(),
    }).eq("id", bookingId);

    // 4. Generate invoice number
    const { data: invoiceNumber, error: numErr } = await supabase.rpc("generate_invoice_number");
    if (numErr || !invoiceNumber) throw new Error("No se pudo generar número de factura");

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
    const { data: invoice, error: insertErr } = await supabase.from("invoices").insert({
      user_id: booking.user_id,
      booking_id: bookingId,
      invoice_number: invoiceNumber,
      status: "paid",
      amount_ars: amountArs,
      paid_at: new Date().toISOString(),
      metadata: { booking_id: bookingId, service: booking.service_name, line_items: lineItems },
    }).select().single();

    if (insertErr) throw new Error(`Error creando factura: ${insertErr.message}`);

    // 7. Generate real PDF
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

    // 8. Upload PDF to storage
    const pdfFileName = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
    const pdfPath = `${invoice.id}/${pdfFileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("invoices")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });

    let pdfUrl: string | null = null;
    if (uploadErr) {
      console.error("[mark-booking-paid] Upload error:", uploadErr);
    } else {
      const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(pdfPath);
      pdfUrl = urlData?.publicUrl || null;
      await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoice.id);
    }

    // 9. Send email (best-effort)
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
                <p>Tu pago fue registrado. Adjuntamos tu factura <strong>${invoiceNumber}</strong> por <strong>${formatPrice(amountArs)}</strong>.</p>
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
      } catch (emailErr) {
        console.error("[mark-booking-paid] Email error:", emailErr);
      }
    }

    console.log("[mark-booking-paid] Success:", invoiceNumber);

    return new Response(JSON.stringify({
      success: true, invoice: { ...invoice, pdf_url: pdfUrl },
      message: `Factura ${invoiceNumber} generada`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[mark-booking-paid] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
