import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { isAudioPlayableWithoutTranscode, transcodeWhatsAppAudioToMp3 } from "../_shared/audioTranscode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RepairRequest = {
  message_id?: string;
  limit?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAdmin(req);
    if ("error" in authResult) return authResult.error;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { message_id, limit = 25 }: RepairRequest = await req.json().catch(() => ({}));

    let query = supabase
      .from("whatsapp_messages")
      .select("id, message_type, media_storage_path, media_mime_type, playable_media_storage_path")
      .in("message_type", ["audio", "voice"])
      .is("playable_media_storage_path", null)
      .not("media_storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit || 25, 1), 50));

    if (message_id) query = query.eq("id", message_id);

    const { data: messages, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const results: Array<{ id: string; status: string; error?: string; playable_path?: string }> = [];

    for (const msg of messages || []) {
      const originalPath = msg.media_storage_path as string | null;
      const originalMime = msg.media_mime_type as string | null;
      if (!originalPath) continue;

      try {
        await supabase.from("whatsapp_messages").update({ media_transcode_status: "processing", media_transcode_error: null }).eq("id", msg.id);

        if (isAudioPlayableWithoutTranscode(originalMime)) {
          await supabase.from("whatsapp_messages").update({
            playable_media_storage_path: originalPath,
            playable_media_mime_type: originalMime,
            media_transcode_status: "completed",
            media_transcode_error: null,
          }).eq("id", msg.id);
          results.push({ id: msg.id, status: "completed", playable_path: originalPath });
          continue;
        }

        const { data: fileData, error: downloadError } = await supabase.storage
          .from("whatsapp-media")
          .download(originalPath);
        if (downloadError || !fileData) throw downloadError || new Error("No se pudo descargar el audio original");

        const mp3Buffer = await transcodeWhatsAppAudioToMp3(new Uint8Array(await fileData.arrayBuffer()));
        const playablePath = originalPath.replace(/\.[^/.]+$/, "") + ".mp3";
        const { error: uploadError } = await supabase.storage
          .from("whatsapp-media")
          .upload(playablePath, mp3Buffer, { contentType: "audio/mpeg", upsert: true });
        if (uploadError) throw uploadError;

        await supabase.from("whatsapp_messages").update({
          playable_media_storage_path: playablePath,
          playable_media_mime_type: "audio/mpeg",
          media_transcode_status: "completed",
          media_transcode_error: null,
        }).eq("id", msg.id);
        results.push({ id: msg.id, status: "completed", playable_path: playablePath });
      } catch (err: any) {
        const error = err?.message || String(err);
        await supabase.from("whatsapp_messages").update({ media_transcode_status: "failed", media_transcode_error: error }).eq("id", msg.id);
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