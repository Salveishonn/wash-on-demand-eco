import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TemplateComponent {
  type: "body" | "header" | "button";
  parameters: Array<{ type: "text"; text: string }>;
}

interface SendTemplateRequest {
  to_phone_e164: string;
  template_name: string;
  template_vars: string[];
  language_code?: string;
  outbox_id?: string;
  entity_type?: "reservation" | "subscription" | "manual";
  entity_id?: string;
  customer_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Meta WhatsApp credentials
  const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("META_WA_PHONE_NUMBER_ID");
  const metaConfigured = !!(accessToken && phoneNumberId);

  console.log("[whatsapp-send] Config:", {
    metaConfigured,
    phoneNumberId: phoneNumberId ? `${phoneNumberId.substring(0, 8)}...` : 'NOT SET',
    accessToken: accessToken ? 'SET (hidden)' : 'NOT SET',
  });

  try {
    // Verify admin if Authorization header present
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        console.error("[whatsapp-send] Auth error:", authError);
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const data: SendTemplateRequest = await req.json();
    console.log("[whatsapp-send] Sending template:", data.template_name, "to:", data.to_phone_e164);

    // Validate required fields
    if (!data.to_phone_e164 || !data.template_name) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone: remove + and any spaces
    const toPhone = data.to_phone_e164.replace(/[^0-9]/g, "");
    const languageCode = data.language_code || "es_AR";
    const templateVars = data.template_vars || [];

    // Build template components
    const components: TemplateComponent[] = [];
    if (templateVars.length > 0) {
      components.push({
        type: "body",
        parameters: templateVars.map((v) => ({ type: "text", text: v })),
      });
    }

    // Check if Meta WhatsApp is configured
    if (!metaConfigured) {
      const missing = [];
      if (!accessToken) missing.push('META_WA_ACCESS_TOKEN');
      if (!phoneNumberId) missing.push('META_WA_PHONE_NUMBER_ID');
      
      console.error("[whatsapp-send] Meta WhatsApp not configured. Missing:", missing);
      
      // Store in outbox for later processing
      const { data: outboxEntry, error: outboxError } = await supabase
        .from("whatsapp_outbox")
        .insert({
          entity_type: data.entity_type || "manual",
          entity_id: data.entity_id || null,
          customer_id: data.customer_id || null,
          to_phone_e164: data.to_phone_e164,
          template_name: data.template_name,
          language_code: languageCode,
          template_vars: templateVars,
          status: "queued",
          last_error: `NO_PROVIDER_CONFIGURED: Missing ${missing.join(', ')}`,
        })
        .select()
        .single();

      if (outboxError) {
        console.error("[whatsapp-send] Outbox insert error:", outboxError);
      }

      return new Response(
        JSON.stringify({ 
          ok: false, 
          stub: true, 
          error: `NO_PROVIDER_CONFIGURED: Missing ${missing.join(', ')}`,
          message: "Meta WhatsApp not configured - queued for later",
          outbox_id: outboxEntry?.id
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Meta WhatsApp Cloud API
    const graphApiUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    
    const requestBody = {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "template",
      template: {
        name: data.template_name,
        language: { code: languageCode },
        components: components.length > 0 ? components : undefined,
      },
    };

    console.log("[whatsapp-send] Sending to Meta API:", JSON.stringify(requestBody));

    const response = await fetch(graphApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log("[whatsapp-send] Meta API response:", JSON.stringify(result));

    if (!response.ok) {
      const errorMsg = result.error?.message || "Meta API error";
      console.error("[whatsapp-send] Meta API error:", result);

      // Update outbox if provided
      if (data.outbox_id) {
        await supabase
          .from("whatsapp_outbox")
          .update({
            status: "failed",
            last_error: errorMsg,
            attempts: 1,
          })
          .eq("id", data.outbox_id);
      }

      return new Response(
        JSON.stringify({ ok: false, error: errorMsg, details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waMessageId = result.messages?.[0]?.id;
    console.log("[whatsapp-send] Message sent, wa_message_id:", waMessageId);

    // Update outbox if provided
    if (data.outbox_id) {
      await supabase
        .from("whatsapp_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          wa_message_id: waMessageId,
          attempts: 1,
        })
        .eq("id", data.outbox_id);
    }

    // Log to whatsapp_messages
    await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: null, // Will be linked if conversation exists
        direction: "outbound",
        body: `[Template: ${data.template_name}] ${templateVars.join(", ")}`,
        status: "sent",
        twilio_message_sid: waMessageId,
      })
      .select()
      .maybeSingle();

    return new Response(
      JSON.stringify({ 
        ok: true, 
        wa_message_id: waMessageId,
        message: "Template sent successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[whatsapp-send] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
