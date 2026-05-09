import OpusDecoder from "https://esm.sh/opus-decoder@0.7.11/src/OpusDecoder.js";
import CodecParser, {
  codecFrames,
  header,
  channels,
  streamCount,
  coupledStreamCount,
  channelMappingTable,
  preSkip,
  data,
} from "https://esm.sh/codec-parser@2.5.0";
import lamejs from "https://esm.sh/lamejs@1.2.1";

export function isAudioPlayableWithoutTranscode(mime?: string | null): boolean {
  const normalized = (mime || "").split(";")[0].trim().toLowerCase();
  return ["audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/wav"].includes(normalized);
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function floatToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function encodeMp3(channelData: Float32Array[], sampleRate: number): Uint8Array {
  if (!channelData.length || !channelData[0]?.length) throw new Error("Decoded audio is empty");
  const channelsCount = Math.min(channelData.length, 2);
  const left = floatToInt16(channelData[0]);
  const right = channelsCount === 2 ? floatToInt16(channelData[1]) : undefined;
  const encoder = new lamejs.Mp3Encoder(channelsCount, sampleRate, 64);
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < left.length; i += 1152) {
    const encoded = channelsCount === 2 && right
      ? encoder.encodeBuffer(left.subarray(i, i + 1152), right.subarray(i, i + 1152))
      : encoder.encodeBuffer(left.subarray(i, i + 1152));
    if (encoded.length) chunks.push(new Uint8Array(encoded));
  }

  const flushed = encoder.flush();
  if (flushed.length) chunks.push(new Uint8Array(flushed));
  return concatUint8Arrays(chunks);
}

export async function transcodeWhatsAppAudioToMp3(input: Uint8Array): Promise<Uint8Array> {
  const parser = new CodecParser("audio/ogg", { enableFrameCRC32: false });
  const pages = [...parser.parseAll(input)];
  const firstFrame = pages.flatMap((page: any) => page[codecFrames] || [])[0];
  if (!firstFrame) throw new Error("No Opus frames found in audio");

  const h = firstFrame[header];
  const decoder = new OpusDecoder({
    channels: h[channels],
    streamCount: h[streamCount],
    coupledStreamCount: h[coupledStreamCount],
    channelMappingTable: h[channelMappingTable],
    preSkip: h[preSkip],
    sampleRate: 48000,
    forceStereo: false,
  });

  await (decoder as any).ready;
  try {
    const frames = pages.flatMap((page: any) => (page[codecFrames] || []).map((frame: any) => frame[data]));
    const decoded = (decoder as any).decodeFrames(frames);
    const mergedChannels = decoded.channelData.map((channelChunks: Float32Array[]) => concatFloat32(channelChunks));
    return encodeMp3(mergedChannels, decoded.sampleRate || 48000);
  } finally {
    (decoder as any).free();
  }
}
