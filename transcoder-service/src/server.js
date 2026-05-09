import express from "express";
import { createClient } from "@supabase/supabase-js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { promises as fs } from "node:fs";
import { createWriteStream, createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";

ffmpeg.setFfmpegPath(ffmpegStatic);

const PORT = process.env.PORT || 8080;
const SHARED_SECRET = process.env.TRANSCODER_SHARED_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "whatsapp-media";
const PREFERRED_FORMAT = (process.env.OUTPUT_FORMAT || "m4a").toLowerCase(); // "m4a" | "mp3"

if (!SHARED_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[transcoder] Missing required env vars: TRANSCODER_SHARED_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "washero-transcoder" }));

app.post("/transcode", async (req, res) => {
  const auth = req.header("x-transcoder-secret");
  if (auth !== SHARED_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { source_path, source_mime } = req.body || {};
  if (!source_path || typeof source_path !== "string") {
    return res.status(400).json({ ok: false, error: "Missing source_path" });
  }

  const jobId = crypto.randomBytes(6).toString("hex");
  const log = (...args) => console.log(`[transcoder][${jobId}]`, ...args);

  const ext = PREFERRED_FORMAT === "mp3" ? "mp3" : "m4a";
  const outMime = ext === "mp3" ? "audio/mpeg" : "audio/mp4";
  const playablePath = source_path.replace(/\.[^/.]+$/, "") + "." + ext;

  const inExt = (source_path.split(".").pop() || "ogg").toLowerCase();
  const inFile = path.join(tmpdir(), `wa-${jobId}-in.${inExt}`);
  const outFile = path.join(tmpdir(), `wa-${jobId}-out.${ext}`);

  try {
    log("download start", { source_path, source_mime });
    const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(source_path);
    if (dlErr || !file) throw new Error("Download failed: " + (dlErr?.message || "no file"));
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inFile, buf);
    log("download ok", { bytes: buf.length });

    log("ffmpeg start", { ext, outFile });
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(inFile);
      if (ext === "m4a") {
        cmd
          .audioCodec("aac")
          .audioBitrate("96k")
          .format("ipod") // m4a container
          .outputOptions(["-movflags", "+faststart"]);
      } else {
        cmd.audioCodec("libmp3lame").audioBitrate("96k").format("mp3");
      }
      cmd
        .on("start", (cl) => log("ffmpeg cmd", cl))
        .on("error", (err) => reject(new Error("ffmpeg: " + err.message)))
        .on("end", () => resolve(null))
        .save(outFile);
    });

    const stat = await fs.stat(outFile);
    log("ffmpeg ok", { outBytes: stat.size });

    const outBuf = await fs.readFile(outFile);
    log("upload start", { playablePath });
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(playablePath, outBuf, { contentType: outMime, upsert: true });
    if (upErr) throw new Error("Upload failed: " + upErr.message);
    log("upload ok");

    return res.json({
      ok: true,
      playable_media_storage_path: playablePath,
      playable_media_mime_type: outMime,
      bytes_in: buf.length,
      bytes_out: stat.size,
    });
  } catch (err) {
    log("ERROR", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    for (const f of [inFile, outFile]) {
      try { await fs.unlink(f); } catch {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`[transcoder] listening on :${PORT}, output=${PREFERRED_FORMAT}`);
});
