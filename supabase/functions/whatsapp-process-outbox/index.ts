import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 25;
const RETRY_DELAYS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000]; // 5min, 15min, 1hr

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
    // Verify admin if Authorization header present
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
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
    }

    if (!accessToken || !phoneNumberId) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "Meta WhatsApp not configured",
          message: "Please configure META_WA_ACCESS_TOKEN and META_WA_PHONE_NUMBER_ID"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[whatsapp-process-outbox] Starting outbox processing");

    // Fetch queued and retry items
    const now = new Date().toISOString();
    const { data: outboxItems, error: fetchError } = await supabase
      .from("whatsapp_outbox")
      .select("*")
      .or(`status.eq.queued,and(status.eq.retry,next_retry_at.lte.${now})`)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("[whatsapp-process-outbox] Fetch error:", fetchError);
      throw fetchError;
    }

    console.log(`[whatsapp-process-outbox] Found ${outboxItems?.length || 0} items to process`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      retrying: 0,
    };

    for (const item of outboxItems || []) {
      results.processed++;
      
      try {
        // Format phone
        const toPhone = item.to_phone_e164.replace(/[^0-9]/g, "");
        const templateVars = item.template_vars || [];

        // Build template components
        const components: any[] = [];
        if (templateVars.length > 0) {
          components.push({
            type: "body",
            parameters: templateVars.map((v: string) => ({ type: "text", text: v })),
          });
        }

        // Send via Meta API
        const graphApiUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
        
        const requestBody = {
          messaging_product: "whatsapp",
          to: toPhone,
          type: "template",
          template: {
            name: item.template_name,
            language: { code: item.language_code || "es_AR" },
            components: components.length > 0 ? components : undefined,
          },
        };

        console.log(`[whatsapp-process-outbox] Sending ${item.id}:`, item.template_name);

        const response = await fetch(graphApiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || "Meta API error");
        }

        const waMessageId = result.messages?.[0]?.id;
        console.log(`[whatsapp-process-outbox] Sent ${item.id}, wa_message_id:`, waMessageId);

        // Update as sent
        await supabase
          .from("whatsapp_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            wa_message_id: waMessageId,
            attempts: item.attempts + 1,
          })
          .eq("id", item.id);

        // Update entity if applicable
        if (item.entity_type === "reservation" && item.entity_id) {
          await supabase
            .from("bookings")
            .update({
              whatsapp_message_status: "sent",
              whatsapp_last_message_type: item.template_name,
            })
            .eq("id", item.entity_id);
        } else if (item.entity_type === "subscription" && item.entity_id) {
          await supabase
            .from("subscriptions")
            .update({
              whatsapp_message_status: "sent",
              whatsapp_last_message_type: item.template_name,
            })
            .eq("id", item.entity_id);
        }

        results.sent++;

      } catch (error: any) {
        console.error(`[whatsapp-process-outbox] Error processing ${item.id}:`, error.message);
        
        const attempts = item.attempts + 1;
        const maxAttempts = 4;

        if (attempts >= maxAttempts) {
          // Mark as permanently failed
          await supabase
            .from("whatsapp_outbox")
            .update({
              status: "failed",
              last_error: error.message,
              attempts,
            })
            .eq("id", item.id);

          // Update entity
          if (item.entity_type === "reservation" && item.entity_id) {
            await supabase
              .from("bookings")
              .update({
                whatsapp_message_status: "failed",
                whatsapp_last_error: error.message,
              })
              .eq("id", item.entity_id);
          } else if (item.entity_type === "subscription" && item.entity_id) {
            await supabase
              .from("subscriptions")
              .update({
                whatsapp_message_status: "failed",
                whatsapp_last_error: error.message,
              })
              .eq("id", item.entity_id);
          }

          results.failed++;
        } else {
          // Schedule retry with exponential backoff
          const retryDelay = RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)];
          const nextRetry = new Date(Date.now() + retryDelay).toISOString();

          await supabase
            .from("whatsapp_outbox")
            .update({
              status: "retry",
              last_error: error.message,
              attempts,
              next_retry_at: nextRetry,
            })
            .eq("id", item.id);

          results.retrying++;
        }
      }
    }

    console.log("[whatsapp-process-outbox] Processing complete:", results);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        results,
        message: `Processed ${results.processed} items: ${results.sent} sent, ${results.failed} failed, ${results.retrying} retrying`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[whatsapp-process-outbox] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
