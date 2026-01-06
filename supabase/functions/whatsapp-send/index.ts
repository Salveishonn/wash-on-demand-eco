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

function validatePhone(phone: string): { valid: boolean; error?: string; forMeta: string; e164: string } {
  const forMeta = normalizePhoneForMeta(phone);
  const e164 = normalizePhoneE164(phone);
  if (forMeta.length < 10) return { valid: false, error: `Too short: ${forMeta.length} digits`, forMeta, e164 };
  if (forMeta.length > 15) return { valid: false, error: `Too long: ${forMeta.length} digits`, forMeta, e164 };
  if (!forMeta.startsWith('54')) return { valid: false, error: `Invalid country code`, forMeta, e164 };
  return { valid: true, forMeta, e164 };
}

// =============================================================
// TEMPLATE CONFIG
// =============================================================
const TEMPLATE_CONFIG: Record<string, { paramCount: number }> = {
  'washero_on_the_way_u01': { paramCount: 2 },
  'washero_booking_confirmed_u01': { paramCount: 3 },
  'washero_reschedule_request': { paramCount: 1 },
  'washero_subscription_active': { paramCount: 3 },
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

  const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("META_WA_PHONE_NUMBER_ID");
  const metaConfigured = !!(accessToken && phoneNumberId);

  console.log("[whatsapp-send] Config:", {
    metaConfigured,
    phoneNumberId: phoneNumberId ? `${phoneNumberId.substring(0, 8)}...` : 'NOT SET',
  });

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

    const data: SendTemplateRequest = await req.json();
    
    // Validate required fields
    if (!data.to_phone_e164 || !data.template_name) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone
    const phoneValidation = validatePhone(data.to_phone_e164);
    if (!phoneValidation.valid) {
      console.error("[whatsapp-send] Invalid phone:", phoneValidation.error);
      return new Response(
        JSON.stringify({ ok: false, error: `Invalid phone: ${phoneValidation.error}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const languageCode = data.language_code || "es_AR";
    
    // Get expected param count and sanitize
    const templateConfig = TEMPLATE_CONFIG[data.template_name];
    const expectedParamCount = templateConfig?.paramCount ?? (data.template_vars?.length || 0);
    const sanitizedParams = sanitizeParams(data.template_vars || [], expectedParamCount);

    console.log("[whatsapp-send] Sending:", {
      template: data.template_name,
      to: phoneValidation.forMeta,
      language: languageCode,
      paramCount: sanitizedParams.length,
      params: sanitizedParams,
    });

    if (!metaConfigured) {
      const missing = [];
      if (!accessToken) missing.push('META_WA_ACCESS_TOKEN');
      if (!phoneNumberId) missing.push('META_WA_PHONE_NUMBER_ID');
      
      console.error("[whatsapp-send] Not configured. Missing:", missing);
      
      // Queue for later
      const { data: outboxEntry } = await supabase
        .from("whatsapp_outbox")
        .insert({
          entity_type: data.entity_type || "manual",
          entity_id: data.entity_id || null,
          customer_id: data.customer_id || null,
          to_phone_e164: phoneValidation.e164,
          template_name: data.template_name,
          language_code: languageCode,
          template_vars: sanitizedParams,
          status: "queued",
          last_error: `NO_PROVIDER_CONFIGURED: Missing ${missing.join(', ')}`,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ 
          ok: false, 
          stub: true, 
          error: `NO_PROVIDER_CONFIGURED: Missing ${missing.join(', ')}`,
          outbox_id: outboxEntry?.id
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build components
    const components = sanitizedParams.length > 0 ? [{
      type: "body",
      parameters: sanitizedParams.map((text) => ({ type: "text", text })),
    }] : undefined;

    const requestBody = {
      messaging_product: "whatsapp",
      to: phoneValidation.forMeta,
      type: "template",
      template: {
        name: data.template_name,
        language: { code: languageCode },
        components,
      },
    };

    console.log("[whatsapp-send] Meta API request:", JSON.stringify(requestBody));

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
    
    console.log("[whatsapp-send] Meta API response:", {
      status: response.status,
      ok: response.ok,
      messageId: result.messages?.[0]?.id,
      error: result.error,
    });

    if (!response.ok) {
      const errorCode = result.error?.code || response.status;
      const errorMsg = result.error?.message || "Meta API error";
      const errorData = result.error?.error_data;
      
      console.error("[whatsapp-send] FAILED:", {
        code: errorCode,
        message: errorMsg,
        error_data: errorData,
        template: data.template_name,
        params: sanitizedParams,
      });

      if (data.outbox_id) {
        await supabase
          .from("whatsapp_outbox")
          .update({
            status: "failed",
            last_error: `META ${errorCode}: ${errorMsg}`,
            attempts: 1,
          })
          .eq("id", data.outbox_id);
      }

      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `META ${errorCode}: ${errorMsg}`,
          debugInfo: { template: data.template_name, params: sanitizedParams, errorData }
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waMessageId = result.messages?.[0]?.id;
    console.log("[whatsapp-send] SUCCESS:", waMessageId);

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
        conversation_id: null,
        direction: "outbound",
        body: `[Template: ${data.template_name}] ${sanitizedParams.join(", ")}`,
        status: "sent",
        twilio_message_sid: waMessageId,
      });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        wa_message_id: waMessageId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[whatsapp-send] Error:", errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
