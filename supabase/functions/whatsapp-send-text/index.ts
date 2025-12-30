import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTextRequest {
  to_phone_e164: string;
  body: string;
  conversation_id?: string;
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

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const data: SendTextRequest = await req.json();
    console.log("[whatsapp-send-text] Sending text to:", data.to_phone_e164);

    if (!data.to_phone_e164 || !data.body) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone
    const toPhone = data.to_phone_e164.replace(/[^0-9]/g, "");

    // Check if Meta WhatsApp is configured
    if (!accessToken || !phoneNumberId) {
      console.log("[whatsapp-send-text] Meta WhatsApp not configured, storing only");
      
      // Store message locally only
      let conversationId = data.conversation_id;
      
      if (!conversationId) {
        // Find or create conversation
        const { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select("id")
          .eq("customer_phone_e164", data.to_phone_e164)
          .maybeSingle();
        conversationId = conv?.id;
      }

      const { data: msg, error: msgError } = await supabase
        .from("whatsapp_messages")
        .insert({
          conversation_id: conversationId,
          direction: "outbound",
          body: data.body,
          status: "queued",
          error: "META_WA_NOT_CONFIGURED",
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ 
          ok: true, 
          stub: true, 
          message: msg,
          warning: "Meta WhatsApp not configured - message stored only"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Meta WhatsApp Cloud API
    const graphApiUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    
    const requestBody = {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: data.body },
    };

    console.log("[whatsapp-send-text] Sending to Meta API");

    const response = await fetch(graphApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log("[whatsapp-send-text] Meta API response:", JSON.stringify(result));

    if (!response.ok) {
      const errorMsg = result.error?.message || "Meta API error";
      
      // Check if it's a 24h window error
      if (result.error?.code === 131047) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: "Ventana de 24h expirada. Usá una plantilla.",
            code: "24H_WINDOW_EXPIRED"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ ok: false, error: errorMsg, details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waMessageId = result.messages?.[0]?.id;

    // Store message
    let conversationId = data.conversation_id;
    
    if (!conversationId) {
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("customer_phone_e164", data.to_phone_e164)
        .maybeSingle();
      conversationId = conv?.id;
    }

    const { data: msg } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        direction: "outbound",
        body: data.body,
        status: "sent",
        twilio_message_sid: waMessageId,
        created_by: user.id,
      })
      .select()
      .single();

    // Update conversation
    if (conversationId) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: data.body.substring(0, 100),
        })
        .eq("id", conversationId);
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        wa_message_id: waMessageId,
        message: msg
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[whatsapp-send-text] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
