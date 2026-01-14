import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EarlyAccessRequest {
  name: string;
  email: string;
  phone: string;
}

serve(async (req) => {
  console.log("[early-access-signup] ====== FUNCTION INVOKED ======");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WASHERO <info@washero.ar>";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { name, email, phone }: EarlyAccessRequest = await req.json();

    console.log("[early-access-signup] Processing signup for:", email);

    // Validate email
    if (!email || !email.includes("@")) {
      throw new Error("Email inválido");
    }

    // 1) Insert into early_access_leads (ignore if already exists)
    const { error: leadError } = await supabase
      .from("early_access_leads")
      .upsert(
        { name, email, phone },
        { onConflict: "email", ignoreDuplicates: true }
      );

    if (leadError) {
      console.error("[early-access-signup] Error inserting lead:", leadError);
      // Continue even if duplicate - we still want to update contacts
    }

    // 2) Use RPC to upsert into contacts (handles deduplication and merging)
    try {
      const { error: rpcError } = await supabase.rpc("upsert_contact", {
        p_email: email,
        p_name: name || null,
        p_phone: phone || null,
        p_source: "early_access",
        p_tags: ["early_access"],
      });

      if (rpcError) {
        console.error("[early-access-signup] Error upserting contact via RPC:", rpcError);
      }
    } catch (contactError) {
      console.error("[early-access-signup] Exception upserting contact:", contactError);
    }

    // 3) Send confirmation email via Resend API
    if (resendApiKey) {
      try {
        const displayName = name || "hola";
        
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject: "🎉 Ya tenés tu 20% OFF asegurado en WASHERO",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #1a1a1a; font-size: 24px;">Hola ${displayName},</h1>
                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                  Gracias por anotarte al acceso anticipado de <strong>WASHERO</strong> 🚗✨
                </p>
                <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 24px; margin: 24px 0;">
                  <p style="color: #0369a1; font-size: 18px; font-weight: bold; margin: 0;">
                    Ya tenés asegurado un 20% OFF en tu primer lavado cuando abramos en abril.
                  </p>
                </div>
                <p style="color: #333; font-size: 16px; line-height: 1.6;">Te avisamos apenas abramos agenda.</p>
                <p style="color: #666; font-size: 14px; margin-top: 32px;">— WASHERO<br/>El lavado premium a domicilio</p>
              </div>
            `,
          }),
        });

        const emailData = await emailResponse.json();
        console.log("[early-access-signup] Email response:", emailData);
      } catch (emailError) {
        console.error("[early-access-signup] Error sending email:", emailError);
      }
    }

    console.log("[early-access-signup] Signup completed successfully");

    return new Response(
      JSON.stringify({ ok: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("[early-access-signup] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
