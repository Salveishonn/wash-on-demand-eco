import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Loader2, Mic, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  url?: string | null;
  mime?: string | null;
  className?: string;
}

/**
 * Cross-browser WhatsApp voice note player.
 *
 * Strategy:
 * 1. Try native <audio> element (works in Chrome, Firefox, Edge)
 * 2. On error (Safari/iOS can't play OGG/Opus) → decode with ogg-opus-decoder → WAV blob → play
 * 3. Final fallback → download link
 */
export function AudioPlayer({ url, mime, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const decodeAttempted = useRef(false);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const attemptFallbackDecode = useCallback(async () => {
    if (!url || decodeAttempted.current) return;
    decodeAttempted.current = true;
    setIsLoading(true);

    try {
      // Dynamically import the decoder (only loaded on Safari/iOS)
      const { OggOpusDecoder } = await import('ogg-opus-decoder');

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();

      const decoder = new OggOpusDecoder();
      await decoder.ready;
      const decoded = await decoder.decode(new Uint8Array(arrayBuffer));
      decoder.free();

      const wavBlob = pcmToWavBlob(decoded.channelData, decoded.sampleRate);
      const newUrl = URL.createObjectURL(wavBlob);

      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(newUrl);
      setError(false);

      // Play the decoded audio
      if (audioRef.current) {
        audioRef.current.src = newUrl;
        try {
          await audioRef.current.play();
        } catch {
          // User interaction might be needed – at least the source is ready
        }
      }
    } catch (e) {
      console.error('[AudioPlayer] Fallback decode failed:', e);
      setDecodeFailed(true);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [url, blobUrl]);

  if (!url) {
    return (
      <div className={cn('flex items-center gap-2 py-1', className)}>
        <Mic className="w-4 h-4 flex-shrink-0 opacity-60" />
        <span className="text-xs italic opacity-70">Audio no disponible</span>
      </div>
    );
  }

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    setIsLoading(true);
    try {
      await audio.play();
    } catch {
      // Native playback failed – try JS-based decoder
      await attemptFallbackDecode();
      return;
    }
    setIsLoading(false);
  };

  const handleNativeError = () => {
    if (!decodeAttempted.current && !decodeFailed) {
      attemptFallbackDecode();
    } else if (!blobUrl) {
      setError(true);
    }
  };

  const fmtDur = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error && decodeFailed) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <span className="text-xs opacity-70 flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5" /> No se pudo reproducir
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Download className="w-3 h-3" /> Descargar audio
        </a>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2.5 min-w-[180px] max-w-[260px]', className)}>
      <audio
        ref={audioRef}
        src={blobUrl || url}
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onPlay={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={handleNativeError}
      />

      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center flex-shrink-0 transition-colors active:scale-95"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="h-2 bg-primary/10 rounded-full cursor-pointer overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-primary/60 rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] opacity-60">
            {currentTime > 0 ? fmtDur(currentTime) : '0:00'}
          </span>
          <span className="text-[10px] opacity-60">
            {duration > 0 ? fmtDur(duration) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── PCM → WAV conversion (pure JS, no deps) ── */
function pcmToWavBlob(channelData: Float32Array[], sampleRate: number): Blob {
  const numChannels = channelData.length;
  const numSamples = channelData[0].length;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
