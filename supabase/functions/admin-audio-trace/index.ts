import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "whatsapp-media";
const SIGNED_URL_TTL_SECONDS = 3600;
const SAFARI_MIMES = new Set(["audio/mp4", "audio/x-m4a"]);

async function fetchHead(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return {
      ok: response.ok,
      status: response.status,
      content_type: response.headers.get("content-type"),
      content_length: response.headers.get("content-length"),
      accept_ranges: response.headers.get("accept-ranges"),
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function objectInfo(supabase: any, path: string) {
  const parts = path.split("/");
  const filename = parts.pop() || path;
  const folder = parts.join("/");
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: 100,
    search: filename,
  });
  const object = (data || []).find((entry: any) => entry.name === filename);
  const metadata = object?.metadata || {};
  return {
    exists: !!object && !error,
    error: error?.message || null,
    path,
    size: metadata.size ?? metadata.contentLength ?? null,
    mime_type: metadata.mimetype ?? metadata.contentType ?? null,
    metadata,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select("id, created_at, message_type, media_storage_path, playable_media_storage_path, media_mime_type, playable_media_mime_type, media_transcode_status, media_transcode_error")
      .in("message_type", ["audio", "voice"])
      .not("playable_media_storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    const traced = [];
    for (const row of rows || []) {
      const playablePath = row.playable_media_storage_path as string;
      const storage = await objectInfo(supabase, playablePath);
      const { data: signed, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(playablePath, SIGNED_URL_TTL_SECONDS);
      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
      const signedUrl = signed?.signedUrl || null;
      const serverFetch = signedUrl ? await fetchHead(signedUrl) : { ok: false, error: signError?.message || "No signed URL" };
      const contentType = (serverFetch as any).content_type?.split(";")[0]?.trim()?.toLowerCase() || "";
      const contentLength = Number((serverFetch as any).content_length || storage.size || 0);

      traced.push({
        id: row.id,
        created_at: row.created_at,
        message_type: row.message_type,
        media_storage_path: row.media_storage_path,
        playable_media_storage_path: row.playable_media_storage_path,
        media_mime_type: row.media_mime_type,
        playable_media_mime_type: row.playable_media_mime_type,
        media_transcode_status: row.media_transcode_status,
        media_transcode_error: row.media_transcode_error,
        bucket: BUCKET,
        signed_url: signedUrl,
        signed_url_expires_at: expiresAt,
        signed_url_ttl_seconds: SIGNED_URL_TTL_SECONDS,
        storage,
        server_fetch: serverFetch,
        validations: {
          file_exists: storage.exists,
          file_size_gt_zero: Number(storage.size || 0) > 0,
          storage_mime_safari_ok: SAFARI_MIMES.has(String(storage.mime_type || "").split(";")[0].trim().toLowerCase()),
          signed_url_generated: !!signedUrl && !signError,
          signed_url_status_200: (serverFetch as any).status === 200,
          signed_url_content_type_safari_ok: SAFARI_MIMES.has(contentType),
          signed_url_content_length_gt_zero: contentLength > 0,
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, bucket: BUCKET, latest_failed_candidate: traced[0] || null, audios: traced }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[admin-audio-trace] Error:", error?.message || String(error));
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});