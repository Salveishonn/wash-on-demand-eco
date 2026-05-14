// Admin-only simulator that invokes botmaker-create-booking with the server-side secret.
// Caller must be an authenticated admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claims } = await supabase.auth.getClaims(token);
  if (!claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Admin check via service role client
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: hasAdmin } = await admin.rpc("has_role", {
    _user_id: claims.claims.sub,
    _role: "admin",
  });
  if (!hasAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);

  const fakePayload = {
    conversation_id: `sim-${Date.now()}`,
    channel: "whatsapp",
    customer_name: "Cliente Simulado",
    customer_phone: "+5491100000001",
    address: "Av. Santa Fe 1234, Palermo, CABA",
    neighborhood: "Palermo",
    vehicle_type: "Auto",
    service_type: "Lavado Básico",
    preferred_date: date,
    preferred_time: "10:00",
    payment_method: "pagar_despues",
    notes: "simulación admin",
  };

  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/botmaker-create-booking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-bm-token": Deno.env.get("BOTMAKER_WEBHOOK_SECRET") ?? "",
    },
    body: JSON.stringify(fakePayload),
  });

  const body = await r.text();
  return new Response(body, {
    status: r.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
