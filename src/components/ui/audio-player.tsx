import { useRef, useState } from 'react';
import { Play, Pause, Loader2, Mic, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  url?: string | null;
  mime?: string | null;
  downloadUrl?: string | null;
  className?: string;
}

export function AudioPlayer({ url, mime, downloadUrl, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const fallbackUrl = downloadUrl || url;

  if (!url) {
    return (
      <div className={cn('flex items-center gap-2 py-1', className)}>
        <Mic className="w-4 h-4 flex-shrink-0 opacity-60" />
        <span className="text-xs italic opacity-70">Audio no disponible</span>
      </div>
    );
  }

  const fmtDur = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    setIsLoading(true);
    try {
      await audio.play();
    } catch (playError) {
      console.error('[AudioPlayer] playback failed', { url, mime, error: playError });
      setError(true);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration || error) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (error) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <span className="text-xs opacity-70 flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5" /> No se pudo reproducir
        </span>
        {fallbackUrl && (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Download className="w-3 h-3" /> Descargar audio
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2.5 min-w-[180px] max-w-[260px]', className)}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          const dur = audio.duration;
          console.log('[AudioPlayer] loadedmetadata', { url, mime, duration: dur });
          if (dur && Number.isFinite(dur) && dur > 0) {
            setDuration(dur);
          }
        }}
        onCanPlay={() => {
          const audio = audioRef.current;
          console.log('[AudioPlayer] canplay', { url, mime, duration: audio?.duration });
        }}
        onDurationChange={() => {
          const audio = audioRef.current;
          if (!audio) return;
          const dur = audio.duration;
          console.log('[AudioPlayer] durationchange', { url, mime, duration: dur });
          if (dur && Number.isFinite(dur) && dur > 0) {
            setDuration(dur);
          }
        }}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (!audio) return;
          const t = audio.currentTime;
          if (Number.isFinite(t)) setCurrentTime(t);
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
          console.error('[AudioPlayer] native playback error', {
            url,
            mime,
            duration: audio?.duration,
            code: mediaError?.code,
            message: mediaError?.message,
          });
          setError(true);
          setIsLoading(false);
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center flex-shrink-0 transition-colors active:scale-95"
        aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
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
