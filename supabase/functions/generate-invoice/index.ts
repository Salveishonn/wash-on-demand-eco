import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateInvoiceRequest {
  booking_id?: string;
  subscription_id?: string;
  type: "single" | "subscription";
  status?: "pending_payment" | "paid";
}

const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const generatePdfHtml = (invoice: any, details: any): string => {
  const lineItems = details.lineItems || [];
  const itemsHtml = lineItems.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.amount)}</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 40px; background: white; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #7ed957; }
    .invoice-info { text-align: right; }
    .invoice-number { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
    .customer-info { margin-bottom: 30px; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .customer-info h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { padding: 12px 8px; background: #f3f4f6; text-align: left; font-weight: 600; }
    .items-table th:last-child { text-align: right; }
    .total-row { font-weight: bold; font-size: 18px; }
    .total-row td { padding-top: 16px; border-top: 2px solid #333; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🚿 WASHERO</div>
    <div class="invoice-info">
      <div class="invoice-number">${invoice.invoice_number}</div>
      <div>Fecha: ${formatDate(new Date(invoice.issued_at))}</div>
      <div style="margin-top: 8px;">
        <span class="status ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">
          ${invoice.status === 'paid' ? 'PAGADO' : 'PENDIENTE DE PAGO'}
        </span>
      </div>
    </div>
  </div>

  <div class="customer-info">
    <h3>CLIENTE</h3>
    <div><strong>${details.customerName || 'Cliente'}</strong></div>
    <div>${details.customerEmail || ''}</div>
    <div>${details.customerPhone || ''}</div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Monto</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
      <tr class="total-row">
        <td style="padding: 16px 8px;">TOTAL</td>
        <td style="padding: 16px 8px; text-align: right;">${formatPrice(invoice.amount_ars)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>WASHERO - Lavado de autos a domicilio</p>
    <p>www.washero.online | contacto@washero.online</p>
  </div>
</body>
</html>
  `;
};

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

    let userId: string | null = null;
    let amountArs: number = 0;
    let customerName: string = "";
    let customerEmail: string = "";
    let customerPhone: string = "";
    let lineItems: { description: string; amount: number }[] = [];
    let metadata: Record<string, unknown> = {};

    // Get invoice details based on type
    if (data.type === "single" && data.booking_id) {
      const { data: booking, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", data.booking_id)
        .single();

      if (error || !booking) {
        throw new Error("Reserva no encontrada");
      }

      userId = booking.user_id;
      amountArs = booking.total_price_ars || Math.round((booking.service_price_cents + (booking.car_type_extra_cents || 0) + (booking.addons_total_cents || 0)) / 100);
      customerName = booking.customer_name;
      customerEmail = booking.customer_email;
      customerPhone = booking.customer_phone;
      
      lineItems = [
        { description: booking.service_name, amount: booking.base_price_ars || Math.round(booking.service_price_cents / 100) },
      ];
      
      if (booking.vehicle_extra_ars > 0) {
        lineItems.push({ description: `Extra tamaño vehículo (${booking.vehicle_size || booking.car_type})`, amount: booking.vehicle_extra_ars });
      }
      
      if (booking.addons && Array.isArray(booking.addons)) {
        for (const addon of booking.addons) {
          lineItems.push({ description: addon.name, amount: addon.price_ars || Math.round(addon.price_cents / 100) });
        }
      }
      
      metadata = { booking_id: data.booking_id, service: booking.service_name };

    } else if (data.type === "subscription" && data.subscription_id) {
      const { data: subscription, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("id", data.subscription_id)
        .single();

      if (error || !subscription) {
        throw new Error("Suscripción no encontrada");
      }

      userId = subscription.user_id;
      amountArs = subscription.subscription_plans?.price_cents 
        ? Math.round(subscription.subscription_plans.price_cents / 100)
        : 0;
      customerName = subscription.customer_name || "";
      customerEmail = subscription.customer_email || "";
      customerPhone = subscription.customer_phone || "";
      
      lineItems = [
        { description: `Suscripción ${subscription.subscription_plans?.name || subscription.plan_code}`, amount: amountArs },
      ];
      
      metadata = { subscription_id: data.subscription_id, plan: subscription.plan_code };
    } else {
      throw new Error("Debe proveer booking_id o subscription_id");
    }

    // Generate invoice number
    const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
    
    if (!invoiceNumber) {
      throw new Error("No se pudo generar número de factura");
    }

    console.log("[generate-invoice] Generated number:", invoiceNumber);

    // Create invoice record
    const invoiceStatus = data.status || "pending_payment";
    
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        booking_id: data.booking_id || null,
        subscription_id: data.subscription_id || null,
        invoice_number: invoiceNumber,
        status: invoiceStatus,
        amount_ars: amountArs,
        paid_at: invoiceStatus === "paid" ? new Date().toISOString() : null,
        metadata,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("[generate-invoice] Insert error:", invoiceError);
      throw new Error(`Error creando factura: ${invoiceError.message}`);
    }

    console.log("[generate-invoice] Invoice created:", invoice.id);

    // Generate PDF HTML
    const pdfHtml = generatePdfHtml(invoice, {
      customerName,
      customerEmail,
      customerPhone,
      lineItems,
    });

    // Upload PDF as HTML file (browsers can render it)
    const pdfFileName = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "-")}.html`;
    const pdfPath = `${invoice.id}/${pdfFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(pdfPath, pdfHtml, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-invoice] Upload error:", uploadError);
    } else {
      // Get public URL
      const { data: urlData } = supabase.storage
        .from("invoices")
        .getPublicUrl(pdfPath);

      if (urlData?.publicUrl) {
        await supabase
          .from("invoices")
          .update({ pdf_url: urlData.publicUrl })
          .eq("id", invoice.id);
        
        invoice.pdf_url = urlData.publicUrl;
      }
    }

    // Send invoice email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Washero <reservas@washero.online>";
    
    if (resendApiKey && customerEmail) {
      try {
        const statusLabel = invoiceStatus === "paid" ? "Pagada" : "Pendiente de pago";
        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #1a1a1a, #333); color: #FFD700; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
  .header h1 { margin: 0; font-size: 22px; }
  .content { background: white; padding: 30px; }
  .invoice-box { background: #FFF8E1; border: 2px solid #FFD700; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
  .invoice-number { font-size: 20px; font-weight: bold; color: #1a1a1a; }
  .amount { font-size: 32px; font-weight: bold; margin: 10px 0; }
  .status { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .status-paid { background: #dcfce7; color: #166534; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .items { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .items td { padding: 10px 0; border-bottom: 1px solid #eee; }
  .items td:last-child { text-align: right; font-weight: 600; }
  .total td { border-top: 2px solid #333; font-size: 18px; font-weight: bold; padding-top: 15px; }
  .cta { text-align: center; margin: 25px 0; }
  .cta a { display: inline-block; background: #FFD700; color: #1a1a1a; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; }
  .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🧼 Tu Factura Washero</h1>
  </div>
  <div class="content">
    <p>Hola <strong>${customerName || "Cliente"}</strong>,</p>
    <p>Adjuntamos tu factura por el servicio contratado.</p>
    <div class="invoice-box">
      <div class="invoice-number">${invoiceNumber}</div>
      <div class="amount">${formatPrice(amountArs)}</div>
      <span class="status ${invoiceStatus === "paid" ? "status-paid" : "status-pending"}">${statusLabel}</span>
    </div>
    <table class="items">
      ${lineItems.map((item: { description: string; amount: number }) => `<tr><td>${item.description}</td><td>${formatPrice(item.amount)}</td></tr>`).join("")}
      <tr class="total"><td>TOTAL</td><td>${formatPrice(amountArs)}</td></tr>
    </table>
    ${invoice.pdf_url ? `<div class="cta"><a href="${invoice.pdf_url}" target="_blank">📄 Ver Factura Completa</a></div>` : ""}
  </div>
  <div class="footer">
    <p>WASHERO - Lavado de autos a domicilio</p>
    <p>www.washero.online | contacto@washero.online</p>
  </div>
</div>
</body>
</html>`;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resendFromEmail,
            to: [customerEmail],
            cc: ["washerocarwash@gmail.com"],
            subject: `Tu factura Washero 🧼✨ - ${invoiceNumber}`,
            html: emailHtml,
          }),
        });

        const emailResult = await emailResponse.json();
        console.log("[generate-invoice] Email result:", emailResponse.ok ? "sent" : emailResult);
      } catch (emailErr) {
        console.error("[generate-invoice] Email error:", emailErr);
      }
    }

    // Emit invoice.created event
    const notifyUrl = `${supabaseUrl}/functions/v1/notify-event`;
    fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        event: "invoice.created",
        timestamp: new Date().toISOString(),
        user_id: userId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName,
        invoice_id: invoice.id,
        booking_id: data.booking_id,
        subscription_id: data.subscription_id,
        amount_ars: amountArs,
        status: invoiceStatus,
        metadata: { invoice_number: invoiceNumber, pdf_url: invoice.pdf_url },
      }),
    }).catch(err => console.error("[generate-invoice] Notify error:", err));

    return new Response(
      JSON.stringify({
        success: true,
        invoice,
        message: `Factura ${invoiceNumber} generada`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[generate-invoice] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
