// Server-side audio transcoding for WhatsApp voice notes.
//
// NOTE: Supabase Edge Functions run on a Deno-based isolate that does NOT
// support `node:vm` / `node:worker_threads`. Every viable Opus decoder on
// npm/esm.sh (opus-decoder, @wasm-audio-decoders/*, ffmpeg-wasm) ultimately
// pulls in `@eshaz/web-worker`, which imports `node:vm` at the top level and
// therefore fails to bundle (`Unknown built-in "node:" module: vm`).
//
// Until we move transcoding to a non-edge runtime (e.g. a small Node/Fly
// worker invoked via HTTP, or n8n with an ffmpeg node), we keep this stub so
// the webhook deploys and stores the original OGG/Opus file. The frontend
// `audio-player.tsx` already has a JS-side `ogg-opus-decoder` fallback that
// transparently decodes Opus → WAV for iOS/Safari/PWA playback.
//
// When server-side transcoding is wired up, replace this module with a real
// implementation that returns an MP3/M4A `Uint8Array`.

const NATIVE_PLAYABLE_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
]);

export function isAudioPlayableWithoutTranscode(mime?: string | null): boolean {
  const normalized = (mime || "").split(";")[0].trim().toLowerCase();
  return NATIVE_PLAYABLE_MIMES.has(normalized);
}

export async function transcodeWhatsAppAudioToMp3(_input: Uint8Array): Promise<Uint8Array> {
  throw new Error(
    "Server-side Opus transcoding is not available in the Supabase Edge runtime " +
      "(node:vm/worker_threads required by every Opus decoder bundle). " +
      "Original OGG/Opus stored; client-side ogg-opus-decoder handles Safari/iOS playback.",
  );
}
