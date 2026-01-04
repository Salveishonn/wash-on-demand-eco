import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// META WHATSAPP CLOUD API - WEBHOOK HANDLER
// ============================================================
// DEPLOYMENT CHECKLIST:
// 1) Webhook verification test URL:
//    https://pkndizbozytnpgqxymms.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=washero_whatsapp_verify_2025&hub.challenge=12345
//    Expected: plain text "12345" with status 200
// 2) After Meta verifies, subscribe webhook fields: messages, message_status
// ============================================================

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

  // Log environment state for debugging (never log actual values)
  console.log("[whatsapp-webhook] Env check:", {
    verifyTokenSet: !!verifyToken,
    verifyTokenLength: verifyToken?.length || 0,
    appSecretSet: !!appSecret,
  });

  try {
    // ============================================================
    // GET: WEBHOOK VERIFICATION (Meta sends this to verify the webhook)
    // ============================================================
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      console.log("[whatsapp-webhook] GET verification request received:", {
        mode: mode,
        tokenReceived: !!token,
        tokenLength: token?.length || 0,
        challengeReceived: !!challenge,
        challengeLength: challenge?.length || 0,
        tokenMatch: token === verifyToken,
      });

      // Check if verify token env var is missing
      if (!verifyToken) {
        console.error("[whatsapp-webhook] CRITICAL: META_WA_VERIFY_TOKEN is undefined or empty!");
        return new Response("Server misconfigured", { 
          status: 500,
          headers: { "Content-Type": "text/plain" }
        });
      }

      // Meta sends hub.mode=subscribe for verification
      if (mode === "subscribe" && token && token === verifyToken) {
        console.log("[whatsapp-webhook] Verification SUCCESS - returning challenge:", challenge);
        // CRITICAL: Return challenge as plain text - this is what Meta expects
        return new Response(challenge || "", { 
          status: 200,
          headers: { "Content-Type": "text/plain" }
        });
      } else {
        console.error("[whatsapp-webhook] Verification FAILED:", {
          modeValid: mode === "subscribe",
          tokenPresent: !!token,
          tokenMatches: token === verifyToken,
        });
        return new Response("Forbidden", { 
          status: 403,
          headers: { "Content-Type": "text/plain" }
        });
      }
    }

    // ============================================================
    // OPTIONS: CORS preflight
    // ============================================================
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ============================================================
    // POST: WEBHOOK EVENTS (incoming messages + status updates)
    // ============================================================
    if (req.method === "POST") {
      const rawBody = await req.text();
      console.log("[whatsapp-webhook] POST received, body length:", rawBody.length);
      
      // Validate signature if app secret is configured
      if (appSecret) {
        const signature = req.headers.get("x-hub-signature-256");
        if (signature) {
          // HMAC SHA256 signature validation
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(appSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
          );
          const signatureBuffer = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(rawBody)
          );
          const expectedSignature = "sha256=" + 
            Array.from(new Uint8Array(signatureBuffer))
              .map(b => b.toString(16).padStart(2, "0"))
              .join("");
          
          if (signature !== expectedSignature) {
            console.warn("[whatsapp-webhook] Invalid signature - continuing anyway for dev");
          } else {
            console.log("[whatsapp-webhook] Signature validation passed");
          }
        }
      }

      const payload = JSON.parse(rawBody);
      console.log("[whatsapp-webhook] Parsed payload type:", payload.object);

      // Log webhook for debugging
      await supabase.from("webhook_logs").insert({
        source: "meta-whatsapp",
        event_type: payload.object || "unknown",
        payload: payload,
        processed: false,
      });

      // ============================================================
      // Process WhatsApp Business Account events
      // ============================================================
      if (payload.object === "whatsapp_business_account") {
        for (const entry of payload.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value;
            console.log("[whatsapp-webhook] Processing change field:", change.field);

            // --------------------------------------------------------
            // INCOMING MESSAGES - Update last_inbound_at for 24h window
            // --------------------------------------------------------
            if (value.messages && value.messages.length > 0) {
              for (const message of value.messages) {
                const fromPhone = normalizePhone(message.from);
                const messageBody = message.text?.body || message.button?.text || message.type || "";
                const waMessageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
                const contactName = value.contacts?.[0]?.profile?.name || null;

                console.log("[whatsapp-webhook] Inbound message:", {
                  from: fromPhone,
                  type: message.type,
                  bodyLength: messageBody.length,
                  waMessageId: waMessageId,
                  timestamp: timestamp,
                });

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
                    .update({ 
                      whatsapp_last_message_at: timestamp,
                      // Update name if we have it and customer doesn't
                      ...(contactName && !existingCustomer.full_name ? { full_name: contactName } : {}),
                    })
                    .eq("id", customer.id);
                } else {
                  // Create new customer from inbound message
                  const { data: newCustomer } = await supabase
                    .from("customers")
                    .insert({
                      phone_e164: fromPhone,
                      full_name: contactName || "WhatsApp User",
                      whatsapp_opt_in: true,
                      whatsapp_opt_in_at: timestamp,
                      whatsapp_last_message_at: timestamp,
                    })
                    .select()
                    .single();
                  customer = newCustomer;
                  console.log("[whatsapp-webhook] Created new customer:", customer?.id);
                }

                // Get or create conversation - ALWAYS update last_inbound_at on inbound
                let conversation = null;
                const { data: existingConv } = await supabase
                  .from("whatsapp_conversations")
                  .select("*")
                  .eq("customer_phone_e164", fromPhone)
                  .maybeSingle();

                if (existingConv) {
                  conversation = existingConv;
                  // Update conversation with last_inbound_at for 24h window tracking
                  const { error: updateError } = await supabase
                    .from("whatsapp_conversations")
                    .update({
                      last_message_at: timestamp,
                      last_message_preview: messageBody.substring(0, 100),
                      last_inbound_at: timestamp, // CRITICAL: Track for 24h session window
                      is_open: true,
                      customer_name: contactName || existingConv.customer_name,
                    })
                    .eq("id", conversation.id);
                  
                  if (updateError) {
                    console.error("[whatsapp-webhook] Error updating conversation:", updateError);
                  } else {
                    console.log("[whatsapp-webhook] Updated conversation with last_inbound_at:", timestamp);
                  }
                } else {
                  // Create new conversation with last_inbound_at set
                  const { data: newConv } = await supabase
                    .from("whatsapp_conversations")
                    .insert({
                      customer_phone_e164: fromPhone,
                      customer_name: contactName || customer?.full_name || "WhatsApp User",
                      customer_id: customer?.id,
                      last_message_at: timestamp,
                      last_message_preview: messageBody.substring(0, 100),
                      last_inbound_at: timestamp, // CRITICAL: Track for 24h session window
                      is_open: true,
                    })
                    .select()
                    .single();
                  conversation = newConv;
                  console.log("[whatsapp-webhook] Created new conversation with last_inbound_at:", conversation?.id);
                }

                // Store message
                const { error: insertError } = await supabase
                  .from("whatsapp_messages")
                  .insert({
                    conversation_id: conversation?.id,
                    direction: "inbound",
                    body: messageBody,
                    status: "received",
                    twilio_message_sid: waMessageId, // Store Meta message ID here
                    created_at: timestamp,
                  });

                if (insertError) {
                  console.error("[whatsapp-webhook] Error storing message:", insertError);
                } else {
                  console.log("[whatsapp-webhook] Inbound message stored successfully, 24h window opened");
                }
              }
            }

            // --------------------------------------------------------
            // MESSAGE STATUS UPDATES (sent/delivered/read/failed)
            // --------------------------------------------------------
            if (value.statuses && value.statuses.length > 0) {
              for (const status of value.statuses) {
                const waMessageId = status.id;
                const newStatus = status.status; // sent, delivered, read, failed
                const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString();
                const errorInfo = status.errors?.[0];

                console.log("[whatsapp-webhook] Status update:", {
                  waMessageId,
                  newStatus,
                  hasError: !!errorInfo,
                  errorCode: errorInfo?.code,
                  errorTitle: errorInfo?.title,
                });

                // Update whatsapp_messages by wa_message_id (stored in twilio_message_sid field)
                const { error: updateMsgError } = await supabase
                  .from("whatsapp_messages")
                  .update({ 
                    status: newStatus,
                    error: errorInfo ? `${errorInfo.code}: ${errorInfo.title}` : null,
                  })
                  .eq("twilio_message_sid", waMessageId);

                if (updateMsgError) {
                  console.error("[whatsapp-webhook] Error updating message status:", updateMsgError);
                }

                // Update whatsapp_outbox by wa_message_id
                const { error: updateOutboxError } = await supabase
                  .from("whatsapp_outbox")
                  .update({ 
                    status: newStatus === "failed" ? "failed" : "sent",
                    sent_at: newStatus !== "failed" ? timestamp : null,
                    last_error: errorInfo ? `${errorInfo.code}: ${errorInfo.title}` : null,
                  })
                  .eq("wa_message_id", waMessageId);

                if (updateOutboxError) {
                  console.log("[whatsapp-webhook] No outbox entry to update (normal for inbound)");
                }
              }
            }
          }
        }
      }

      // Mark webhook as processed (by ID from insert)
      console.log("[whatsapp-webhook] Processing complete");

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response("Method not allowed", { status: 405 });

  } catch (error: any) {
    console.error("[whatsapp-webhook] Error:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});