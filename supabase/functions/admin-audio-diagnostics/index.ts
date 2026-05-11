import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function maskUrl(url: string) {
  return url ? url.replace(/[?&](apikey|token|secret|sig|signature)=[^&]+/gi, "$1=***") : "";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(`timeout_${timeoutMs}ms`), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const TRANSCODER_URL_RAW = Deno.env.get("WHATSAPP_TRANSCODER_URL") || "";
  const TRANSCODER_SECRET = Deno.env.get("WHATSAPP_TRANSCODER_SECRET") || "";
  const BUCKET = "whatsapp-media";

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const result: any = {
    ok: true,
    config: {
      supabase_url: SUPABASE_URL,
      bucket: BUCKET,
      transcoder_url_present: !!TRANSCODER_URL_RAW,
      transcoder_url: maskUrl(TRANSCODER_URL_RAW),
      transcoder_secret_present: !!TRANSCODER_SECRET,
      transcoder_secret_len: TRANSCODER_SECRET.length,
      service_key_present: !!SERVICE_KEY,
    },
    checks: {} as Record<string, any>,
    counts: {},
    latest: {},
  };

  console.log("[admin-audio-diagnostics] Runtime env:", {
    transcoderUrlPresent: !!TRANSCODER_URL_RAW,
    transcoderUrl: maskUrl(TRANSCODER_URL_RAW),
    transcoderSecretPresent: !!TRANSCODER_SECRET,
    transcoderSecretLen: TRANSCODER_SECRET.length,
    serviceKeyPresent: !!SERVICE_KEY,
  });

  // 1) Bucket
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const found = buckets?.find((b) => b.name === BUCKET);
    result.checks.bucket = found
      ? { ok: true, public: found.public }
      : { ok: false, error: `Bucket '${BUCKET}' not found` };
  } catch (e: any) {
    result.checks.bucket = { ok: false, error: e.message };
  }

  // 2) Recent audio messages
  const { data: msgs } = await supabase
    .from("whatsapp_messages")
    .select(
      "id, created_at, message_type, media_mime_type, media_storage_path, playable_media_storage_path, playable_media_mime_type, media_transcode_status, media_transcode_error",
    )
    .in("message_type", ["audio", "voice"])
    .order("created_at", { ascending: false })
    .limit(10);
  result.recent_audios = msgs || [];

  // 3) Test signed URL on most recent audio with a path
  const sample = (msgs || []).find((m) => m.playable_media_storage_path || m.media_storage_path);
  if (sample) {
    const path = sample.playable_media_storage_path || sample.media_storage_path!;
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
      if (error) throw error;
      result.checks.signed_url = { ok: true, sample_id: sample.id, url_preview: data?.signedUrl?.slice(0, 80) + "..." };
    } catch (e: any) {
      result.checks.signed_url = { ok: false, error: e.message };
    }
  } else {
    result.checks.signed_url = { ok: null, note: "No audio messages with storage path to test" };
  }

  // 4) Transcoder reachability (health)
  if (TRANSCODER_URL_RAW) {
    let base = TRANSCODER_URL_RAW.trim().replace(/\/+$/, "").replace(/\/transcode$/i, "");
    try {
      const r = await fetch(base + "/health", { method: "GET" });
      const txt = await r.text();
      result.checks.transcoder_health = { ok: r.ok, status: r.status, body: txt.slice(0, 200) };
    } catch (e: any) {
      result.checks.transcoder_health = { ok: false, error: e.message };
    }

    // 5) Shared secret check: send POST without secret → should 401
    try {
      const r = await fetch(base + "/transcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_path: "diagnostic-no-such-file" }),
      });
      const txt = await r.text();
      result.checks.transcoder_rejects_missing_secret = {
        ok: r.status === 401,
        status: r.status,
        body: txt.slice(0, 200),
      };
    } catch (e: any) {
      result.checks.transcoder_rejects_missing_secret = { ok: false, error: e.message };
    }

    // 6) Shared secret check: with secret + bogus path → should 500 (not 401)
    try {
      const r = await fetch(base + "/transcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-transcoder-secret": TRANSCODER_SECRET,
        },
        body: JSON.stringify({ source_path: "diagnostic-no-such-file.ogg", source_mime: "audio/ogg" }),
      });
      const txt = await r.text();
      result.checks.transcoder_secret_accepted = {
        ok: r.status !== 401,
        status: r.status,
        body: txt.slice(0, 300),
      };
    } catch (e: any) {
      result.checks.transcoder_secret_accepted = { ok: false, error: e.message };
    }
  } else {
    result.checks.transcoder_health = { ok: false, error: "WHATSAPP_TRANSCODER_URL not set" };
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
