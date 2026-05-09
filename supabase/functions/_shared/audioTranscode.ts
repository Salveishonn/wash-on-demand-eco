import { OggOpusDecoder } from "https://esm.sh/ogg-opus-decoder@1.7.3";
import lamejs from "https://esm.sh/lamejs@1.2.1";

export function isAudioPlayableWithoutTranscode(mime?: string | null): boolean {
  const normalized = (mime || "").split(";")[0].trim().toLowerCase();
  return ["audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/wav"].includes(normalized);
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
  if (!channelData.length || !channelData[0]?.length) {
    throw new Error("Decoded audio is empty");
  }

  const channels = Math.min(channelData.length, 2);
  const left = floatToInt16(channelData[0]);
  const right = channels === 2 ? floatToInt16(channelData[1]) : undefined;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, 64);
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const encoded = channels === 2 && right
      ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + blockSize))
      : encoder.encodeBuffer(leftChunk);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded));
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) chunks.push(new Uint8Array(finalChunk));
  return concatUint8Arrays(chunks);
}

export async function transcodeWhatsAppAudioToMp3(input: Uint8Array): Promise<Uint8Array> {
  const decoder = new OggOpusDecoder({ sampleRate: 48000, forceStereo: false });
  try {
    await decoder.ready;
    const decoded = await decoder.decodeFile(input);
    return encodeMp3(decoded.channelData, decoded.sampleRate || 48000);
  } finally {
    decoder.free();
  }
}