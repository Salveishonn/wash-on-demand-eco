import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscriptionNotification {
  subscriptionId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  planName: string;
  planCode?: string;
  priceArs?: number;
  status: string;
  washesPerMonth?: number;
}

serve(async (req) => {
  console.log("[admin-notify-subscription] ====== FUNCTION INVOKED ======");

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
    const subscription: SubscriptionNotification = await req.json();

    console.log("[admin-notify-subscription] Processing subscription notification for:", subscription.customerEmail);

    // 1) Upsert customer into contacts using RPC
    if (subscription.customerEmail) {
      try {
        const { error: rpcError } = await supabase.rpc("upsert_contact", {
          p_email: subscription.customerEmail,
          p_name: subscription.customerName || null,
          p_phone: subscription.customerPhone || null,
          p_source: "subscription",
          p_tags: ["subscription"],
        });

        if (rpcError) {
          console.error("[admin-notify-subscription] Error upserting contact via RPC:", rpcError);
        }
      } catch (contactError) {
        console.error("[admin-notify-subscription] Exception upserting contact:", contactError);
      }
    }

    // 2) Send admin notification email via fetch
    if (resendApiKey) {
      try {
        const priceFormatted = subscription.priceArs ? `$${subscription.priceArs.toLocaleString("es-AR")}/mes` : "Por confirmar";
        const statusLabels: Record<string, string> = { pending: "⏳ Pendiente de aprobación", active: "✅ Activa", paused: "⏸️ Pausada", cancelled: "❌ Cancelada" };
        const statusFormatted = statusLabels[subscription.status] || subscription.status;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [adminEmail],
            subject: `🔄 Nueva Suscripción - ${subscription.customerName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #1a1a1a; font-size: 24px; border-bottom: 2px solid #10b981; padding-bottom: 12px;">Nueva Suscripción Mensual</h1>
                <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; margin: 20px 0;">
                  <p style="color: #059669; font-size: 18px; font-weight: bold; margin: 0;">${subscription.planName || "Plan Mensual"}</p>
                  <p style="color: #047857; font-size: 24px; font-weight: bold; margin: 8px 0 0 0;">${priceFormatted}</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Cliente</td><td style="padding: 12px; background: #f8fafc;">${subscription.customerName}</td></tr>
                  <tr><td style="padding: 12px; font-weight: bold;">Email</td><td style="padding: 12px;">${subscription.customerEmail}</td></tr>
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Teléfono</td><td style="padding: 12px; background: #f8fafc;">${subscription.customerPhone}</td></tr>
                  <tr><td style="padding: 12px; font-weight: bold;">Lavados/Mes</td><td style="padding: 12px;">${subscription.washesPerMonth || "Según plan"}</td></tr>
                  <tr><td style="padding: 12px; background: #f8fafc; font-weight: bold;">Estado</td><td style="padding: 12px; background: #f8fafc;">${statusFormatted}</td></tr>
                </table>
                ${subscription.status === "pending" ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-top: 20px;"><p style="color: #92400e; margin: 0; font-weight: bold;">⚠️ Acción requerida: Esta suscripción necesita aprobación en el panel de administración.</p></div>` : ""}
                <p style="color: #666; font-size: 12px; margin-top: 24px; text-align: center;">Este email fue generado automáticamente por el sistema de WASHERO.</p>
              </div>
            `,
          }),
        });

        const emailData = await emailResponse.json();
        console.log("[admin-notify-subscription] Admin email sent:", emailData);
      } catch (emailError) {
        console.error("[admin-notify-subscription] Error sending admin email:", emailError);
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
    console.error("[admin-notify-subscription] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
