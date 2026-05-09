import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Loader2, Mic, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface AudioPlayerProps {
  url?: string | null;
  mime?: string | null;
  downloadUrl?: string | null;
  /** Storage path inside the whatsapp-media bucket. Used to regenerate signed URLs on expiry/errors. */
  storagePath?: string | null;
  /** Storage path for the original (download fallback). */
  originalStoragePath?: string | null;
  className?: string;
}

const BUCKET = 'whatsapp-media';

export function AudioPlayer({
  url,
  mime,
  downloadUrl,
  storagePath,
  originalStoragePath,
  className,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentSrc, setCurrentSrc] = useState<string | null>(url || null);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const refreshAttempts = useRef(0);

  useEffect(() => {
    setCurrentSrc(url || null);
    setError(false);
    refreshAttempts.current = 0;
  }, [url]);

  const refreshSignedUrl = useCallback(async (): Promise<string | null> => {
    if (!storagePath) return null;
    try {
      const { data, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 3600);
      if (signErr || !data?.signedUrl) {
        console.warn('[AudioPlayer] signed URL refresh failed', signErr);
        return null;
      }
      return data.signedUrl;
    } catch (e) {
      console.warn('[AudioPlayer] signed URL refresh threw', e);
      return null;
    }
  }, [storagePath]);

  if (!url && !storagePath) {
    return (
      <div className={cn('flex items-center gap-2 py-1', className)}>
        <Mic className="w-4 h-4 flex-shrink-0 opacity-60" />
        <span className="text-xs italic opacity-70">Audio no disponible</span>
      </div>
    );
  }

  const fmtDur = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    setIsLoading(true);
    setError(false);

    // Ensure we have a src; if not, fetch a signed one.
    if (!audio.src || audio.src === window.location.href) {
      const fresh = await refreshSignedUrl();
      if (fresh) {
        setCurrentSrc(fresh);
        audio.src = fresh;
        audio.load();
      }
    }

    try {
      await audio.play();
    } catch (playError) {
      console.warn('[AudioPlayer] play() failed, attempting URL refresh', playError);
      // Try refreshing once on first failure (likely expired URL).
      if (refreshAttempts.current < 1) {
        refreshAttempts.current += 1;
        const fresh = await refreshSignedUrl();
        if (fresh) {
          setCurrentSrc(fresh);
          audio.src = fresh;
          audio.load();
          try {
            await audio.play();
            return;
          } catch (retryErr) {
            console.error('[AudioPlayer] retry play failed', retryErr);
          }
        }
      }
      setError(true);
      setIsLoading(false);
    }
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const audio = audioRef.current;
    if (!audio) return;
    setError(false);
    refreshAttempts.current = 0;
    const fresh = (await refreshSignedUrl()) || url;
    if (fresh) {
      setCurrentSrc(fresh);
      audio.src = fresh;
      audio.load();
    }
  };

  const handleDownloadClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    let href = downloadUrl || currentSrc || url;
    if (originalStoragePath) {
      try {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(originalStoragePath, 3600, { download: true });
        if (data?.signedUrl) href = data.signedUrl;
      } catch {
        /* ignore */
      }
    }
    if (!href) return;
    // Open in new tab without navigating away from the chat.
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={cn('flex items-center gap-2.5 min-w-[180px] max-w-[280px]', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={currentSrc || undefined}
        preload="metadata"
        playsInline
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          const dur = audio.duration;
          if (dur && Number.isFinite(dur) && dur > 0) setDuration(dur);
        }}
        onDurationChange={() => {
          const audio = audioRef.current;
          if (!audio) return;
          const dur = audio.duration;
          if (dur && Number.isFinite(dur) && dur > 0) setDuration(dur);
        }}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (!audio) return;
          if (Number.isFinite(audio.currentTime)) setCurrentTime(audio.currentTime);
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
        onError={() => {
          const audio = audioRef.current;
          const mediaError = audio?.error;
          console.warn('[AudioPlayer] native error', {
            url: currentSrc,
            mime,
            code: mediaError?.code,
            message: mediaError?.message,
          });
          // Don't immediately switch to "error" UI — only flag if user already tried to play.
          if (isPlaying || isLoading) {
            setError(true);
            setIsLoading(false);
            setIsPlaying(false);
          }
        }}
      />

      <button
        type="button"
        onClick={error ? handleRetry : togglePlay}
        className="w-9 h-9 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center flex-shrink-0 transition-colors active:scale-95"
        aria-label={
          error ? 'Reintentar' : isPlaying ? 'Pausar audio' : 'Reproducir audio'
        }
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : error ? (
          <RotateCw className="w-4 h-4" />
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
            {error ? 'Error' : currentTime > 0 ? fmtDur(currentTime) : '0:00'}
          </span>
          <span className="text-[10px] opacity-60">
            {duration > 0 ? fmtDur(duration) : '—'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownloadClick}
        className="w-7 h-7 rounded-full hover:bg-primary/15 flex items-center justify-center flex-shrink-0 transition-colors opacity-60 hover:opacity-100"
        aria-label="Descargar audio"
        title="Descargar"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
