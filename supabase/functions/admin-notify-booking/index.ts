import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotification {
  bookingId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookingDate: string;
  bookingTime: string;
  address: string;
  serviceName: string;
  vehicleSize?: string;
  addons?: any[];
  paymentMethod?: string;
  paymentStatus?: string;
  totalArs?: number;
}

serve(async (req) => {
  console.log("[admin-notify-booking] ====== FUNCTION INVOKED ======");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WASHERO <info@washero.ar>";
  const adminEmail = "info@washero.ar";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const booking: BookingNotification = await req.json();

    console.log("[admin-notify-booking] Processing booking notification for:", booking.customerEmail);

    // 1) Upsert customer into contacts
    if (booking.customerEmail) {
      const existingTags = ["booking"];
      
      // Check if contact exists and get current tags
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("tags")
        .eq("email", booking.customerEmail)
        .single();

      let mergedTags = existingTags;
      if (existingContact?.tags) {
        const currentTags = existingContact.tags as string[];
        mergedTags = [...new Set([...currentTags, ...existingTags])];
      }

      const { error: contactError } = await supabase
        .from("contacts")
        .upsert(
          {
            email: booking.customerEmail,
            name: booking.customerName || null,
            phone: booking.customerPhone || null,
            source: existingContact ? undefined : "booking",
            tags: mergedTags,
            last_seen_at: new Date().toISOString(),
          },
          { 
            onConflict: "email",
            ignoreDuplicates: false
          }
        );

      if (contactError) {
        console.error("[admin-notify-booking] Error upserting contact:", contactError);
      }
    }

    // 2) Send admin notification email via fetch
    if (resendApiKey) {
      try {
        let addonsText = "Ninguno";
        if (booking.addons && booking.addons.length > 0) {
          addonsText = booking.addons.map((a: any) => a.name || a).join(", ");
        }
        const totalFormatted = booking.totalArs ? `$${booking.totalArs.toLocaleString("es-AR")}` : "Por confirmar";

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [adminEmail],
            subject: `🚗 Nueva Reserva - ${booking.customerName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #1a1a1a; font-size: 24px; border-bottom: 2px solid #0ea5e9; padding-bottom: 12px;">Nueva Reserva de Lavado</h1>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Cliente</td><td style="padding: 12px; background: #f8fafc;">${booking.customerName}</td></tr>
                  <tr><td style="padding: 12px; font-weight: bold;">Email</td><td style="padding: 12px;">${booking.customerEmail}</td></tr>
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Teléfono</td><td style="padding: 12px; background: #f8fafc;">${booking.customerPhone}</td></tr>
                  <tr><td style="padding: 12px; font-weight: bold;">Fecha</td><td style="padding: 12px;">${booking.bookingDate}</td></tr>
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Horario</td><td style="padding: 12px; background: #f8fafc;">${booking.bookingTime}</td></tr>
                  <tr><td style="padding: 12px; font-weight: bold;">Dirección</td><td style="padding: 12px;">${booking.address || "No especificada"}</td></tr>
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Servicio</td><td style="padding: 12px; background: #f8fafc;">${booking.serviceName}</td></tr>
                  <tr><td style="padding: 12px; font-weight: bold;">Vehículo</td><td style="padding: 12px;">${booking.vehicleSize || "Estándar"}</td></tr>
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Extras</td><td style="padding: 12px; background: #f8fafc;">${addonsText}</td></tr>
                  <tr><td style="padding: 12px; font-weight: bold;">Método de Pago</td><td style="padding: 12px;">${booking.paymentMethod || "No especificado"}</td></tr>
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Estado de Pago</td><td style="padding: 12px; background: #f8fafc;">${booking.paymentStatus || "Pendiente"}</td></tr>
                  <tr><td style="padding: 12px; font-weight: bold; font-size: 18px;">Total</td><td style="padding: 12px; font-weight: bold; font-size: 18px; color: #0ea5e9;">${totalFormatted}</td></tr>
                </table>
                <p style="color: #666; font-size: 12px; margin-top: 24px; text-align: center;">Este email fue generado automáticamente por el sistema de WASHERO.</p>
              </div>
            `,
          }),
        });

        const emailData = await emailResponse.json();
        console.log("[admin-notify-booking] Admin email sent:", emailData);
      } catch (emailError) {
        console.error("[admin-notify-booking] Error sending admin email:", emailError);
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("[admin-notify-booking] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
