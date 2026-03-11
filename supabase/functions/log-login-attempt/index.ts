import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { logLoginAttempt, isLoginBlocked } from "../_shared/securityUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, success } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if blocked before logging
    if (!success) {
      const blocked = await isLoginBlocked(email);
      if (blocked) {
        return new Response(
          JSON.stringify({ blocked: true, message: "Demasiados intentos. Esperá 15 minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await logLoginAttempt(email, success, req);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[log-login-attempt] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
