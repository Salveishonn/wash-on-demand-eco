import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAudioPlayableWithoutTranscode } from "../_shared/audioTranscode.ts";

function normalizeSourceMimeForTranscoder(sourceMime: string | null): string {
  const normalized = (sourceMime || "").trim().toLowerCase();
  if (!normalized || normalized === "audio/ogg") return "audio/ogg; codecs=opus";
  return sourceMime || "audio/ogg; codecs=opus";
}

async function callExternalTranscoder(
  sourcePath: string,
  sourceMime: string | null,
): Promise<{ playable_media_storage_path: string; playable_media_mime_type: string } | null> {
  const rawUrl = Deno.env.get("WHATSAPP_TRANSCODER_URL");
  const secret = Deno.env.get("WHATSAPP_TRANSCODER_SECRET");
  console.log("[whatsapp-webhook] Transcoder env:", {
    urlPresent: !!rawUrl,
    urlValue: rawUrl,
    secretPresent: !!secret,
    secretLen: secret?.length || 0,
  });
  if (!rawUrl || !secret) {
    console.warn("[whatsapp-webhook] Transcoder not configured (WHATSAPP_TRANSCODER_URL/SECRET missing)");
    return null;
  }
  // Auto-append /transcode if user set base URL only
  let url = rawUrl.trim().replace(/\/+$/, "");
  if (!/\/transcode$/i.test(url)) url = url + "/transcode";
  const requestBody = {
    source_path: sourcePath,
    source_mime: normalizeSourceMimeForTranscoder(sourceMime),
  };
  console.log("[whatsapp-webhook] Calling transcoder:", url, requestBody);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-transcoder-secret": secret },
    body: JSON.stringify(requestBody),
  });
  const text = await res.text().catch(() => "");
  console.log("[whatsapp-webhook] Transcoder response:", { status: res.status, bodyPreview: text.slice(0, 500) });
  if (!res.ok) {
    throw new Error(`Transcoder HTTP ${res.status}: ${text}`);
  }
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error("Transcoder returned non-JSON: " + text.slice(0, 200)); }
  if (!json?.ok) throw new Error("Transcoder returned ok=false: " + (json?.error || "unknown"));
  if (!json.playable_media_storage_path || !json.playable_media_mime_type) {
    throw new Error("Transcoder returned missing playable media fields");
  }
  return {
    playable_media_storage_path: json.playable_media_storage_path,
    playable_media_mime_type: json.playable_media_mime_type,
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^0-9]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

// ── Media helpers ──────────────────────────────────────────────
async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string,
): Promise<{ buffer: Uint8Array; mimeType: string } | null> {
  try {
    // Step 1 – get the download URL from Meta
    const metaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      console.error("[whatsapp-webhook] Meta media lookup failed:", metaRes.status, await metaRes.text());
      return null;
    }
    const metaJson = await metaRes.json();
    const downloadUrl: string = metaJson.url;
    const mimeType: string = metaJson.mime_type || "audio/ogg";

    // Step 2 – download the actual binary
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      console.error("[whatsapp-webhook] Media download failed:", fileRes.status);
      return null;
    }
    const buffer = new Uint8Array(await fileRes.arrayBuffer());
    return { buffer, mimeType };
  } catch (err: any) {
    console.error("[whatsapp-webhook] downloadWhatsAppMedia error:", err.message);
    return null;
  }
}

function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/opus": "opus",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/amr": "amr",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
  };
  return map[mime.split(";")[0].trim()] || "bin";
}

// ── Handlers ───────────────────────────────────────────────────
async function handleInboundMessages(
  supabase: any,
  value: any,
  accessToken: string | undefined,
  supabaseUrl: string,
  supabaseServiceKey: string,
) {
  for (const message of value.messages) {
    const fromPhone = normalizePhone(message.from);
    const waMessageId = message.id;
    const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
    const contactName = value.contacts?.[0]?.profile?.name || null;

    // Determine message type & body
    const msgType: string = message.type || "text";
    let messageBody = "";
    let mediaCaption: string | null = null;
    let mediaFilename: string | null = null;
    if (msgType === "text") {
      messageBody = message.text?.body || "";
    } else if (msgType === "button") {
      messageBody = message.button?.text || "";
    } else {
      // For media types, use caption (preferred) or fallback label
      const m: any = message[msgType] || {};
      mediaCaption = m.caption || null;
      mediaFilename = m.filename || null;
      messageBody = mediaCaption || mediaFilename || `[${msgType}]`;
    }

    const previewIcon = (t: string) => {
      if (t === "audio" || t === "voice") return "🎤 Audio";
      if (t === "image") return "📷 Imagen";
      if (t === "video") return "🎥 Video";
      if (t === "document") return `📄 ${mediaFilename || "Documento"}`;
      if (t === "sticker") return "🌟 Sticker";
      if (t === "location") return "📍 Ubicación";
      if (t === "contacts") return "👤 Contacto";
      if (t === "unsupported") return "⚠️ Mensaje no soportado";
      return messageBody;
    };
    const previewText = msgType === "text" ? messageBody.substring(0, 100) : previewIcon(msgType);

    console.log("[whatsapp-webhook] Inbound:", { from: fromPhone, type: msgType, waMessageId });

    // ── Customer upsert ──
    let customer: any = null;
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("*")
      .eq("phone_e164", fromPhone)
      .maybeSingle();

    if (existingCustomer) {
      customer = existingCustomer;
      await supabase
        .from("customers")
        .update({
          whatsapp_last_message_at: timestamp,
          ...(contactName && !existingCustomer.full_name ? { full_name: contactName } : {}),
        })
        .eq("id", customer.id);
    } else {
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
    }

    // ── Conversation upsert ──
    let conversation: any = null;
    const { data: existingConv } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("customer_phone_e164", fromPhone)
      .maybeSingle();

    if (existingConv) {
      conversation = existingConv;
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: timestamp,
          last_message_preview: previewText,
          last_inbound_at: timestamp,
          is_open: true,
          customer_name: contactName || existingConv.customer_name,
        })
        .eq("id", conversation.id);
    } else {
      const { data: newConv } = await supabase
        .from("whatsapp_conversations")
        .insert({
          customer_phone_e164: fromPhone,
          customer_name: contactName || customer?.full_name || "WhatsApp User",
          customer_id: customer?.id,
          last_message_at: timestamp,
          last_message_preview: previewText,
          last_inbound_at: timestamp,
          is_open: true,
        })
        .select()
        .single();
      conversation = newConv;
    }

    // ── Handle media download (audio, voice, image, video, document, sticker) ──
    let mediaUrl: string | null = null;
    let mediaMime: string | null = null;
    let mediaIdStr: string | null = null;
    let mediaSize: number | null = null;
    let mediaStoragePath: string | null = null;
    let playableMediaStoragePath: string | null = null;
    let playableMediaMimeType: string | null = null;
    let mediaTranscodeStatus: string | null = null;
    let mediaTranscodeError: string | null = null;

    const mediaTypes = ["audio", "voice", "image", "video", "document", "sticker"];
    if (mediaTypes.includes(msgType)) {
      const mediaObj = message[msgType];
      const mediaId = mediaObj?.id;
      mediaIdStr = mediaId || null;
      mediaMime = mediaObj?.mime_type || null;

      if (mediaId && accessToken) {
        const downloaded = await downloadWhatsAppMedia(mediaId, accessToken);
        if (downloaded) {
          mediaMime = downloaded.mimeType || mediaMime;
          mediaSize = downloaded.buffer.byteLength;
          const ext = mediaFilename?.split(".").pop()?.toLowerCase() || mimeToExtension(mediaMime || "");
          const safeId = waMessageId.replace(/[^a-zA-Z0-9_-]/g, "");
          const storageFolder = conversation?.id || fromPhone.replace("+", "");
          mediaStoragePath = `${storageFolder}/${safeId}.${ext}`;

          const storageClient = createClient(supabaseUrl, supabaseServiceKey);
          const { error: uploadErr } = await storageClient.storage
            .from("whatsapp-media")
            .upload(mediaStoragePath, downloaded.buffer, {
              contentType: mediaMime || "application/octet-stream",
              upsert: true,
            });

          if (uploadErr) {
            console.error("[whatsapp-webhook] Storage upload error:", uploadErr);
          } else {
            const { data: urlData } = storageClient.storage
              .from("whatsapp-media")
              .getPublicUrl(mediaStoragePath);
            mediaUrl = urlData?.publicUrl || null;
            console.log("[whatsapp-webhook] Media stored:", { type: msgType, mime: mediaMime, size: mediaSize, url: mediaUrl });

            if (msgType === "audio" || msgType === "voice") {
              if (isAudioPlayableWithoutTranscode(mediaMime)) {
                playableMediaStoragePath = mediaStoragePath;
                playableMediaMimeType = mediaMime;
                mediaTranscodeStatus = "completed";
              } else {
                mediaTranscodeStatus = "processing";
                try {
                  const result = await callExternalTranscoder(mediaStoragePath, mediaMime);
                  if (!result) {
                    mediaTranscodeStatus = "failed";
                    mediaTranscodeError = "Transcoder service not configured";
                  } else {
                    playableMediaStoragePath = result.playable_media_storage_path;
                    playableMediaMimeType = result.playable_media_mime_type;
                    mediaTranscodeStatus = "completed";
                    console.log("[whatsapp-webhook] Audio transcoded via external service:", {
                      originalMime: mediaMime,
                      outputMime: playableMediaMimeType,
                      originalSize: mediaSize,
                      path: playableMediaStoragePath,
                    });
                  }
                } catch (transcodeErr: any) {
                  mediaTranscodeStatus = "failed";
                  mediaTranscodeError = transcodeErr?.message || String(transcodeErr);
                  console.error("[whatsapp-webhook] Audio transcode failed:", {
                    mime: mediaMime,
                    path: mediaStoragePath,
                    error: mediaTranscodeError,
                  });
                }
              }
            }
          }
        } else {
          console.warn("[whatsapp-webhook] Media download returned null for", mediaId);
        }
      }
    }

    // ── Store message ──
    const { error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversation?.id,
        direction: "inbound",
        body: messageBody,
        status: "received",
        twilio_message_sid: waMessageId,
        created_at: timestamp,
        message_type: msgType === "voice" ? "audio" : msgType,
        media_url: mediaUrl,
        media_mime_type: mediaMime,
        media_id: mediaIdStr,
        media_size: mediaSize,
        media_filename: mediaFilename,
        media_caption: mediaCaption,
        media_storage_path: mediaStoragePath,
        playable_media_storage_path: playableMediaStoragePath,
        playable_media_mime_type: playableMediaMimeType,
        media_transcode_status: mediaTranscodeStatus,
        media_transcode_error: mediaTranscodeError,
      });

    if (insertError) {
      console.error("[whatsapp-webhook] Error storing message:", insertError);
    } else {
      console.log("[whatsapp-webhook] Message stored, type:", msgType);

      // Smart push notification for inbound WhatsApp message
      const senderName = contactName || fromPhone;
      const preview = msgType === "text"
        ? `"${messageBody.slice(0, 40)}"`
        : previewIcon(msgType);

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-ops-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            event_type: "whatsapp_incoming_message",
            title: "💬 Nuevo mensaje de cliente",
            body: `${senderName}:\n${preview}`,
            tag: "whatsapp-message",
            url: "/ops/messages",
            requireInteraction: true,
            data: {
              tab: "messages",
              url: "/ops/messages",
              conversation_phone: fromPhone,
              message_type: msgType,
            },
          }),
        });
      } catch (pushErr: any) {
        console.error("[whatsapp-webhook] Failed to trigger push:", pushErr.message);
      }
    }
  }
}

async function handleStatusUpdates(
  supabase: any,
  statuses: any[],
) {
  for (const status of statuses) {
    const waMessageId = status.id;
    const newStatus = status.status;
    const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString();
    const errorInfo = status.errors?.[0];

    console.log("[whatsapp-webhook] Status:", { waMessageId, newStatus, errorCode: errorInfo?.code });

    await supabase
      .from("whatsapp_messages")
      .update({
        status: newStatus,
        error: errorInfo ? `${errorInfo.code}: ${errorInfo.title}` : null,
      })
      .eq("twilio_message_sid", waMessageId);

    await supabase
      .from("whatsapp_outbox")
      .update({
        status: newStatus === "failed" ? "failed" : "sent",
        sent_at: newStatus !== "failed" ? timestamp : null,
        last_error: errorInfo ? `${errorInfo.code}: ${errorInfo.title}` : null,
      })
      .eq("wa_message_id", waMessageId);
  }
}

// ── Main server ────────────────────────────────────────────────
serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const verifyToken = Deno.env.get("META_WA_VERIFY_TOKEN");
  const appSecret = Deno.env.get("META_WA_APP_SECRET");
  const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN");

  try {
    // ── GET: Webhook verification ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (!verifyToken) {
        return new Response("Server misconfigured", { status: 500, headers: { "Content-Type": "text/plain" } });
      }

      if (mode === "subscribe" && token === verifyToken) {
        return new Response(challenge || "", { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain" } });
    }

    // ── OPTIONS: CORS ──
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ── POST: Webhook events ──
    if (req.method === "POST") {
      const rawBody = await req.text();
      console.log("[whatsapp-webhook] POST received, length:", rawBody.length);

      // Signature validation
      if (appSecret) {
        const signature = req.headers.get("x-hub-signature-256");
        if (signature) {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey("raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
          const buf = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
          const expected = "sha256=" + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
          if (signature !== expected) {
            console.warn("[whatsapp-webhook] Invalid signature");
          }
        }
      }

      const payload = JSON.parse(rawBody);

      // Log webhook
      await supabase.from("webhook_logs").insert({
        source: "meta-whatsapp",
        event_type: payload.object || "unknown",
        payload,
        processed: false,
      });

      if (payload.object === "whatsapp_business_account") {
        for (const entry of payload.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value;

            if (value.messages?.length > 0) {
              await handleInboundMessages(supabase, value, accessToken, supabaseUrl, supabaseServiceKey);
            }

            if (value.statuses?.length > 0) {
              await handleStatusUpdates(supabase, value.statuses);
            }
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error: any) {
    console.error("[whatsapp-webhook] Error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
