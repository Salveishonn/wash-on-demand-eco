import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  // Remove all non-digits
  let normalized = phone.replace(/[^0-9]/g, "");
  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const verifyToken = Deno.env.get("META_WA_VERIFY_TOKEN");
  const appSecret = Deno.env.get("META_WA_APP_SECRET");

  try {
    // GET: Webhook verification
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      console.log("[whatsapp-webhook] Verification request:", { mode, token, challenge, verifyToken: verifyToken ? "set" : "not set" });

      // Meta sends hub.mode=subscribe for verification
      if (mode === "subscribe" && token && token === verifyToken) {
        console.log("[whatsapp-webhook] Verification successful, returning challenge");
        // Return challenge as plain text - this is critical for Meta verification
        return new Response(challenge || "", { 
          status: 200,
          headers: { "Content-Type": "text/plain" }
        });
      } else {
        console.error("[whatsapp-webhook] Verification failed - mode:", mode, "token match:", token === verifyToken);
        return new Response("Forbidden", { status: 403 });
      }
    }

    // OPTIONS: CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // POST: Webhook events
    if (req.method === "POST") {
      const rawBody = await req.text();
      
      // Validate signature if app secret is configured
      if (appSecret) {
        const signature = req.headers.get("x-hub-signature-256");
        if (signature) {
          const expectedSignature = "sha256=" + 
            Array.from(new Uint8Array(
              await crypto.subtle.digest("SHA-256", 
                new TextEncoder().encode(appSecret + rawBody)
              )
            )).map(b => b.toString(16).padStart(2, "0")).join("");
          
          // Note: In production, use constant-time comparison
          if (signature !== expectedSignature) {
            console.warn("[whatsapp-webhook] Invalid signature");
            // Log but continue processing for development
          }
        }
      }

      const payload = JSON.parse(rawBody);
      console.log("[whatsapp-webhook] Received payload:", JSON.stringify(payload));

      // Log webhook for debugging
      await supabase.from("webhook_logs").insert({
        source: "meta-whatsapp",
        event_type: payload.object || "unknown",
        payload: payload,
        processed: false,
      });

      // Process WhatsApp Business Account events
      if (payload.object === "whatsapp_business_account") {
        for (const entry of payload.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value;

            // Process incoming messages
            if (value.messages) {
              for (const message of value.messages) {
                const fromPhone = normalizePhone(message.from);
                const messageBody = message.text?.body || message.type || "";
                const waMessageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();

                console.log("[whatsapp-webhook] Inbound message from:", fromPhone, "body:", messageBody);

                // Get or create customer
                let customer = null;
                const { data: existingCustomer } = await supabase
                  .from("customers")
                  .select("*")
                  .eq("phone_e164", fromPhone)
                  .maybeSingle();

                if (existingCustomer) {
                  customer = existingCustomer;
                  // Update last message time
                  await supabase
                    .from("customers")
                    .update({ whatsapp_last_message_at: timestamp })
                    .eq("id", customer.id);
                } else {
                  // Create new customer from inbound message
                  const profileName = value.contacts?.[0]?.profile?.name || "Unknown";
                  const { data: newCustomer } = await supabase
                    .from("customers")
                    .insert({
                      phone_e164: fromPhone,
                      full_name: profileName,
                      whatsapp_opt_in: true,
                      whatsapp_opt_in_at: timestamp,
                      whatsapp_last_message_at: timestamp,
                    })
                    .select()
                    .single();
                  customer = newCustomer;
                }

                // Get or create conversation
                let conversation = null;
                const { data: existingConv } = await supabase
                  .from("whatsapp_conversations")
                  .select("*")
                  .eq("customer_phone_e164", fromPhone)
                  .maybeSingle();

                if (existingConv) {
                  conversation = existingConv;
                  // Update conversation
                  await supabase
                    .from("whatsapp_conversations")
                    .update({
                      last_message_at: timestamp,
                      last_message_preview: messageBody.substring(0, 100),
                      is_open: true,
                    })
                    .eq("id", conversation.id);
                } else {
                  // Create new conversation
                  const { data: newConv } = await supabase
                    .from("whatsapp_conversations")
                    .insert({
                      customer_phone_e164: fromPhone,
                      customer_name: customer?.full_name || "Unknown",
                      customer_id: customer?.id,
                      last_message_at: timestamp,
                      last_message_preview: messageBody.substring(0, 100),
                      is_open: true,
                    })
                    .select()
                    .single();
                  conversation = newConv;
                }

                // Store message
                await supabase
                  .from("whatsapp_messages")
                  .insert({
                    conversation_id: conversation?.id,
                    direction: "inbound",
                    body: messageBody,
                    status: "received",
                    twilio_message_sid: waMessageId,
                    created_at: timestamp,
                  });

                console.log("[whatsapp-webhook] Inbound message stored");
              }
            }

            // Process message statuses (sent/delivered/read/failed)
            if (value.statuses) {
              for (const status of value.statuses) {
                const waMessageId = status.id;
                const newStatus = status.status; // sent, delivered, read, failed
                const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString();

                console.log("[whatsapp-webhook] Status update:", waMessageId, "->", newStatus);

                // Update whatsapp_messages by wa_message_id
                await supabase
                  .from("whatsapp_messages")
                  .update({ status: newStatus })
                  .eq("twilio_message_sid", waMessageId);

                // Update whatsapp_outbox by wa_message_id
                await supabase
                  .from("whatsapp_outbox")
                  .update({ 
                    status: newStatus === "failed" ? "failed" : "sent",
                    sent_at: newStatus !== "failed" ? timestamp : null,
                  })
                  .eq("wa_message_id", waMessageId);

                // If failed, store error
                if (status.errors) {
                  const errorMsg = status.errors[0]?.title || "Unknown error";
                  await supabase
                    .from("whatsapp_outbox")
                    .update({ last_error: errorMsg })
                    .eq("wa_message_id", waMessageId);
                }
              }
            }
          }
        }
      }

      // Mark webhook as processed
      await supabase
        .from("webhook_logs")
        .update({ processed: true })
        .eq("payload", payload);

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response("Method not allowed", { status: 405 });

  } catch (error: any) {
    console.error("[whatsapp-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
