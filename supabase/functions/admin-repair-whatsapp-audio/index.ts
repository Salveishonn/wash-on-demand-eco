import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { isAudioPlayableWithoutTranscode } from "../_shared/audioTranscode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RepairRequest = { message_id?: string; limit?: number; latest_failed?: boolean };

function normalizeSourceMimeForTranscoder(sourceMime: string | null): string {
  const normalized = (sourceMime || "").trim().toLowerCase();
  if (!normalized || normalized === "audio/ogg") return "audio/ogg; codecs=opus";
  return sourceMime || "audio/ogg; codecs=opus";
}

async function callExternalTranscoder(sourcePath: string, sourceMime: string | null) {
  const rawUrl = Deno.env.get("WHATSAPP_TRANSCODER_URL");
  const secret = Deno.env.get("WHATSAPP_TRANSCODER_SECRET");
  console.log("[repair] Transcoder env:", { urlPresent: !!rawUrl, urlValue: rawUrl, secretPresent: !!secret, secretLen: secret?.length || 0 });
  if (!rawUrl || !secret) throw new Error("Transcoder service not configured");
  let url = rawUrl.trim().replace(/\/+$/, "");
  if (!/\/transcode$/i.test(url)) url = url + "/transcode";
  const requestBody = { source_path: sourcePath, source_mime: normalizeSourceMimeForTranscoder(sourceMime) };
  console.log("[repair] Calling transcoder:", url, requestBody);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("transcoder_timeout_90000ms"), 90_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-transcoder-secret": secret },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (fetchErr: any) {
    console.error("[repair] Transcoder fetch failed:", {
      url,
      sourcePath,
      name: fetchErr?.name,
      message: fetchErr?.message || String(fetchErr),
    });
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }
  const text = await res.text().catch(() => "");
  console.log("[repair] Transcoder response:", { status: res.status, body: text.slice(0, 1000) });
  if (!res.ok) throw new Error(`Transcoder HTTP ${res.status}: ${text}`);
  const json = JSON.parse(text);
  if (!json?.ok) throw new Error("Transcoder ok=false: " + (json?.error || "unknown"));
  if (!json.playable_media_storage_path || !json.playable_media_mime_type) {
    throw new Error("Transcoder returned missing playable media fields");
  }
  return {
    playable_media_storage_path: json.playable_media_storage_path as string,
    playable_media_mime_type: json.playable_media_mime_type as string,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await requireAdmin(req);
    if ("error" in authResult) return authResult.error;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { message_id, limit = 25, latest_failed = false }: RepairRequest = await req.json().catch(() => ({}));

    let query = supabase
      .from("whatsapp_messages")
      .select("id, message_type, media_storage_path, media_mime_type, playable_media_storage_path")
      .in("message_type", ["audio", "voice"])
      .not("media_storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(latest_failed ? 1 : Math.min(Math.max(limit || 25, 1), 50));

    if (message_id) query = query.eq("id", message_id);
    if (latest_failed) {
      query = query.eq("media_transcode_status", "failed");
    }

    const { data: messages, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const results: Array<{ id: string; status: string; error?: string; playable_path?: string }> = [];

    const repairableMessages = (messages || []).filter((msg: any) => {
      if (message_id || latest_failed) return true;
      return !msg.playable_media_storage_path || ["failed", "pending", "processing"].includes(msg.media_transcode_status || "");
    });

    for (const msg of repairableMessages) {
      const originalPath = msg.media_storage_path as string | null;
      const originalMime = msg.media_mime_type as string | null;
      if (!originalPath) continue;

      try {
        await supabase.from("whatsapp_messages").update({ media_transcode_status: "processing", media_transcode_error: null }).eq("id", msg.id);

        if (isAudioPlayableWithoutTranscode(originalMime)) {
          const { error: updateError } = await supabase.from("whatsapp_messages").update({
            playable_media_storage_path: originalPath,
            playable_media_mime_type: originalMime,
            media_transcode_status: "success",
            media_transcode_error: null,
          }).eq("id", msg.id);
          console.log("[repair] DB update result:", { id: msg.id, success: !updateError, error: updateError?.message, playablePath: originalPath });
          if (updateError) throw updateError;
          results.push({ id: msg.id, status: "success", playable_path: originalPath });
          continue;
        }

        const result = await callExternalTranscoder(originalPath, originalMime);
        const { error: updateError } = await supabase.from("whatsapp_messages").update({
          playable_media_storage_path: result.playable_media_storage_path,
          playable_media_mime_type: result.playable_media_mime_type,
          media_transcode_status: "success",
          media_transcode_error: null,
        }).eq("id", msg.id);
        console.log("[repair] DB update result:", { id: msg.id, success: !updateError, error: updateError?.message, playablePath: result.playable_media_storage_path });
        if (updateError) throw updateError;
        results.push({ id: msg.id, status: "success", playable_path: result.playable_media_storage_path });
      } catch (err: any) {
        const error = err?.message || String(err);
        const { error: failUpdateError } = await supabase.from("whatsapp_messages").update({ media_transcode_status: "failed", media_transcode_error: error }).eq("id", msg.id);
        console.log("[repair] DB failure update result:", { id: msg.id, success: !failUpdateError, error: failUpdateError?.message, transcodeError: error });
        results.push({ id: msg.id, status: "failed", error });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[admin-repair-whatsapp-audio] Error:", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
