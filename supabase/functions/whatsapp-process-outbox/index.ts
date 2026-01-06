import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================
// PHONE NORMALIZATION - E.164 for Argentina
// =============================================================
function normalizePhoneE164(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) cleaned = cleaned.substring(1);
  
  if (cleaned.startsWith('549') && cleaned.length >= 12) return '+' + cleaned;
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    const rest = cleaned.substring(2);
    if (rest.startsWith('11') || rest.startsWith('15') || rest.length === 10) {
      let mobile = rest;
      if (mobile.startsWith('15')) mobile = mobile.substring(2);
      return '+549' + mobile;
    }
    return '+54' + rest;
  }
  if (cleaned.startsWith('15') && cleaned.length >= 8) return '+54911' + cleaned.substring(2);
  if (cleaned.startsWith('11') && cleaned.length >= 10) return '+549' + cleaned;
  if (cleaned.startsWith('9') && cleaned.length >= 10) return '+54' + cleaned;
  if (cleaned.length === 10) return '+549' + cleaned;
  if (cleaned.length === 8) return '+54911' + cleaned;
  if (cleaned.length >= 8 && cleaned.length <= 12 && !cleaned.startsWith('54')) return '+54' + cleaned;
  return '+' + cleaned;
}

function normalizePhoneForMeta(phone: string): string {
  return normalizePhoneE164(phone).replace(/[^0-9]/g, '');
}

function validatePhone(phone: string): { valid: boolean; error?: string; forMeta: string } {
  const forMeta = normalizePhoneForMeta(phone);
  if (forMeta.length < 10) return { valid: false, error: `Too short: ${forMeta.length} digits`, forMeta };
  if (forMeta.length > 15) return { valid: false, error: `Too long: ${forMeta.length} digits`, forMeta };
  if (!forMeta.startsWith('54')) return { valid: false, error: `Invalid country code`, forMeta };
  return { valid: true, forMeta };
}

// =============================================================
// TEMPLATE CONFIG - Must match Meta exactly
// =============================================================
const TEMPLATE_CONFIG: Record<string, { paramCount: number }> = {
  'washero_on_the_way_u01': { paramCount: 2 },
  'washero_booking_confirmed_u01': { paramCount: 3 },
  'washero_reschedule_request': { paramCount: 1 },
  'washero_subscription_active': { paramCount: 3 },
  'washero_on_the_way': { paramCount: 2 },
  'washero_arriving_10_min': { paramCount: 2 },
  'washero_arrived': { paramCount: 1 },
  'washero_booking_confirmed': { paramCount: 3 },
  'washero_payment_instructions': { paramCount: 2 },
};

function sanitizeParams(params: unknown[], expectedCount: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    const value = params[i];
    if (value === null || value === undefined || value === '') {
      result.push('N/D');
    } else {
      result.push(String(value).trim());
    }
  }
  return result;
}

const BATCH_SIZE = 25;
const RETRY_DELAYS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("META_WA_PHONE_NUMBER_ID");

  try {
    // Auth check
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
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[whatsapp-process-outbox] Starting outbox processing");

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

    const results = { processed: 0, sent: 0, failed: 0, retrying: 0 };

    for (const item of outboxItems || []) {
      results.processed++;
      
      try {
        // Validate phone
        const phoneValidation = validatePhone(item.to_phone_e164);
        if (!phoneValidation.valid) {
          throw new Error(`Invalid phone: ${phoneValidation.error}`);
        }
        
        // Get template config and sanitize params
        const templateConfig = TEMPLATE_CONFIG[item.template_name];
        const expectedParamCount = templateConfig?.paramCount ?? (item.template_vars?.length || 0);
        const templateVars = item.template_vars || [];
        const sanitizedParams = sanitizeParams(templateVars, expectedParamCount);

        // Build components
        const components: unknown[] = [];
        if (sanitizedParams.length > 0) {
          components.push({
            type: "body",
            parameters: sanitizedParams.map((text: string) => ({ type: "text", text })),
          });
        }

        const requestBody = {
          messaging_product: "whatsapp",
          to: phoneValidation.forMeta,
          type: "template",
          template: {
            name: item.template_name,
            language: { code: item.language_code || "es_AR" },
            components: components.length > 0 ? components : undefined,
          },
        };

        console.log(`[whatsapp-process-outbox] Sending ${item.id}:`, {
          template: item.template_name,
          to: phoneValidation.forMeta,
          params: sanitizedParams,
        });

        const response = await fetch(
          `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          const errorCode = result.error?.code || response.status;
          const errorMsg = result.error?.message || "Meta API error";
          throw new Error(`META ${errorCode}: ${errorMsg}`);
        }

        const waMessageId = result.messages?.[0]?.id;
        console.log(`[whatsapp-process-outbox] Sent ${item.id}:`, waMessageId);

        await supabase
          .from("whatsapp_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            wa_message_id: waMessageId,
            attempts: item.attempts + 1,
            last_error: null,
          })
          .eq("id", item.id);

        // Update entity status
        if (item.entity_type === "reservation" && item.entity_id) {
          await supabase
            .from("bookings")
            .update({
              whatsapp_message_status: "sent",
              whatsapp_last_message_type: item.template_name,
              whatsapp_last_error: null,
            })
            .eq("id", item.entity_id);
        } else if (item.entity_type === "subscription" && item.entity_id) {
          await supabase
            .from("subscriptions")
            .update({
              whatsapp_message_status: "sent",
              whatsapp_last_message_type: item.template_name,
              whatsapp_last_error: null,
            })
            .eq("id", item.entity_id);
        }

        results.sent++;

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[whatsapp-process-outbox] Error processing ${item.id}:`, errorMessage);
        
        const attempts = item.attempts + 1;
        const maxAttempts = 4;

        if (attempts >= maxAttempts) {
          await supabase
            .from("whatsapp_outbox")
            .update({
              status: "failed",
              last_error: errorMessage,
              attempts,
            })
            .eq("id", item.id);

          // Update entity with failure
          if (item.entity_type === "reservation" && item.entity_id) {
            await supabase
              .from("bookings")
              .update({
                whatsapp_message_status: "failed",
                whatsapp_last_error: errorMessage,
              })
              .eq("id", item.entity_id);
          } else if (item.entity_type === "subscription" && item.entity_id) {
            await supabase
              .from("subscriptions")
              .update({
                whatsapp_message_status: "failed",
                whatsapp_last_error: errorMessage,
              })
              .eq("id", item.entity_id);
          }

          results.failed++;
        } else {
          const retryDelay = RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)];
          const nextRetry = new Date(Date.now() + retryDelay).toISOString();

          await supabase
            .from("whatsapp_outbox")
            .update({
              status: "retry",
              last_error: errorMessage,
              attempts,
              next_retry_at: nextRetry,
            })
            .eq("id", item.id);

          results.retrying++;
        }
      }
    }

    console.log("[whatsapp-process-outbox] Complete:", results);

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[whatsapp-process-outbox] Error:", errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
