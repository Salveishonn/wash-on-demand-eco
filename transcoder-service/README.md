# Washero WhatsApp Transcoder Service

Standalone Node service that converts WhatsApp voice notes (`audio/ogg; codecs=opus`) into iOS/Safari-friendly `.m4a` (AAC) or `.mp3`, then uploads the result back into the Supabase `whatsapp-media` bucket.

The Supabase Edge Function `whatsapp-webhook` calls this service over HTTP after storing the original file. The service is **stateless**: it streams the original from Supabase, transcodes in `/tmp`, uploads, and cleans up.

---

## Endpoints

### `GET /health`
Liveness probe.

### `POST /transcode`
Headers:
- `x-transcoder-secret: <TRANSCODER_SHARED_SECRET>` (required)
- `Content-Type: application/json`

Body:
```json
{ "source_path": "conv-uuid/wamid.xxx.ogg", "source_mime": "audio/ogg; codecs=opus" }
```

Response:
```json
{
  "ok": true,
  "playable_media_storage_path": "conv-uuid/wamid.xxx.m4a",
  "playable_media_mime_type": "audio/mp4",
  "bytes_in": 12345,
  "bytes_out": 23456
}
```

---

## Environment variables

| Var | Required | Default | Description |
|-----|----------|---------|-------------|
| `TRANSCODER_SHARED_SECRET` | yes | — | Shared secret the webhook must send in `x-transcoder-secret`. |
| `SUPABASE_URL` | yes | — | e.g. `https://pkndizbozytnpgqxymms.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — | Service role key (server-side only). |
| `SUPABASE_BUCKET` | no | `whatsapp-media` | Bucket name. |
| `OUTPUT_FORMAT` | no | `m4a` | `m4a` (AAC) or `mp3`. |
| `PORT` | no | `8080` | Listen port. |

---

## Deploy on Render

1. Push this folder (`transcoder-service/`) to a Git repo (or use the existing repo with a Render "Root Directory" of `transcoder-service`).
2. Render → **New → Web Service** → connect repo.
3. Settings:
   - **Runtime**: Node
   - **Root Directory**: `transcoder-service`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance**: Starter (512 MB is enough)
4. Add env vars listed above.
5. Deploy. Note the public URL, e.g. `https://washero-transcoder.onrender.com`.

`ffmpeg-static` ships a static binary that works on Render's Linux containers — no Dockerfile needed.

---

## Wire up in Supabase

In the Supabase project secrets add:

- `WHATSAPP_TRANSCODER_URL` → `https://washero-transcoder.onrender.com/transcode`
- `WHATSAPP_TRANSCODER_SECRET` → same value as `TRANSCODER_SHARED_SECRET` above

The `whatsapp-webhook` function will automatically call the transcoder when these are set; if absent it falls back to storing the original OGG only.

---

## Local test

```bash
cd transcoder-service
npm install
TRANSCODER_SHARED_SECRET=dev SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run dev

curl -X POST http://localhost:8080/transcode \
  -H "x-transcoder-secret: dev" \
  -H "Content-Type: application/json" \
  -d '{"source_path":"some/folder/wamid.HBgN....ogg"}'
```
