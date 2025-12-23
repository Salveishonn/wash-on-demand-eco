import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "washerocarwash@gmail.com";
const ADMIN_WHATSAPP = "+5491130951804";

interface KipperLeadRequest {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleType?: string;
  bookingId?: string;
  source: "booking" | "confirmation" | "subscription";
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: KipperLeadRequest = await req.json();
    console.log("[create-kipper-lead] Request:", body);

    // Validate required fields
    if (!body.customerName || !body.customerPhone || !body.customerEmail || !body.source) {
      return new Response(
        JSON.stringify({ error: "Campos requeridos: nombre, teléfono, email, source" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create lead record
    const { data: lead, error: leadError } = await supabase
      .from("kipper_leads")
      .insert({
        customer_name: body.customerName,
        customer_phone: body.customerPhone,
        customer_email: body.customerEmail,
        vehicle_type: body.vehicleType || null,
        booking_id: body.bookingId || null,
        source: body.source,
        status: "new",
      })
      .select()
      .single();

    if (leadError) {
      console.error("[create-kipper-lead] Insert error:", leadError);
      throw new Error("Error al crear el lead");
    }

    console.log("[create-kipper-lead] Lead created:", lead.id);

    // Send admin notifications
    const sourceLabels: Record<string, string> = {
      booking: "Durante Reserva",
      confirmation: "Post-Confirmación",
      subscription: "Página Suscripciones",
    };

    const messageContent = `🏷️ NUEVO LEAD KIPPER SEGUROS

📋 Fuente: ${sourceLabels[body.source] || body.source}
👤 Nombre: ${body.customerName}
📞 Teléfono: ${body.customerPhone}
📧 Email: ${body.customerEmail}
🚗 Vehículo: ${body.vehicleType || "No especificado"}
${body.bookingId ? `📝 Reserva: ${body.bookingId.substring(0, 8).toUpperCase()}` : ""}

Este cliente está interesado en recibir una cotización de seguro con Kipper Seguros.`;

    // Send Email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const emailResult = await resend.emails.send({
          from: "Washero <onboarding@resend.dev>",
          to: [ADMIN_EMAIL],
          subject: `🏷️ Nuevo Lead Kipper Seguros - ${body.customerName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #8B1E2F, #6B1726); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Lead Kipper Seguros</h1>
              </div>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Fuente:</td>
                    <td style="padding: 8px 0;">${sourceLabels[body.source] || body.source}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Nombre:</td>
                    <td style="padding: 8px 0;">${body.customerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Teléfono:</td>
                    <td style="padding: 8px 0;"><a href="tel:${body.customerPhone}">${body.customerPhone}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                    <td style="padding: 8px 0;"><a href="mailto:${body.customerEmail}">${body.customerEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Vehículo:</td>
                    <td style="padding: 8px 0;">${body.vehicleType || "No especificado"}</td>
                  </tr>
                  ${body.bookingId ? `
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Reserva:</td>
                    <td style="padding: 8px 0; font-family: monospace;">${body.bookingId.substring(0, 8).toUpperCase()}</td>
                  </tr>
                  ` : ""}
                </table>
                <p style="margin-top: 20px; color: #666;">
                  Este cliente está interesado en recibir una cotización de seguro con Kipper Seguros.
                </p>
              </div>
            </div>
          `,
        });
        console.log("[create-kipper-lead] Email sent:", emailResult);
      } catch (emailErr) {
        console.error("[create-kipper-lead] Email error:", emailErr);
      }
    }

    // Send WhatsApp via Twilio
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (twilioAccountSid && twilioAuthToken && twilioWhatsAppNumber) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        
        const whatsappResult = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: `whatsapp:${twilioWhatsAppNumber}`,
            To: `whatsapp:${ADMIN_WHATSAPP}`,
            Body: messageContent,
          }),
        });

        const whatsappData = await whatsappResult.json();
        console.log("[create-kipper-lead] WhatsApp sent:", whatsappData.sid);
      } catch (waErr) {
        console.error("[create-kipper-lead] WhatsApp error:", waErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, leadId: lead.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[create-kipper-lead] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
