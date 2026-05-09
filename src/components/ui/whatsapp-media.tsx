import { useState } from 'react';
import { FileText, Download, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { AudioPlayer } from '@/components/ui/audio-player';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface WhatsAppMediaProps {
  messageType?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaFilename?: string | null;
  mediaCaption?: string | null;
  mediaSize?: number | null;
  body?: string | null;
  className?: string;
}

const formatBytes = (b?: number | null) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export function WhatsAppMedia({
  messageType,
  mediaUrl,
  mediaMime,
  mediaFilename,
  mediaCaption,
  mediaSize,
  body,
  className,
}: WhatsAppMediaProps) {
  const [imageOpen, setImageOpen] = useState(false);
  const type = (messageType || 'text').toLowerCase();

  // Plain text
  if (type === 'text' || type === 'button') {
    return <p className={cn('text-sm whitespace-pre-wrap break-words', className)}>{body}</p>;
  }

  // Audio / voice notes
  if (type === 'audio' || type === 'voice') {
    return (
      <div className={className}>
        <AudioPlayer url={mediaUrl} mime={mediaMime} />
        {mediaCaption && <p className="text-xs mt-1 opacity-80 whitespace-pre-wrap">{mediaCaption}</p>}
      </div>
    );
  }

  // Images & stickers
  if ((type === 'image' || type === 'sticker') && mediaUrl) {
    return (
      <div className={className}>
        <button onClick={() => setImageOpen(true)} className="block">
          <img
            src={mediaUrl}
            alt={mediaCaption || 'Imagen'}
            className="rounded-lg max-w-[240px] max-h-[280px] object-cover"
            loading="lazy"
          />
        </button>
        {mediaCaption && <p className="text-xs mt-1 whitespace-pre-wrap break-words">{mediaCaption}</p>}
        <Dialog open={imageOpen} onOpenChange={setImageOpen}>
          <DialogContent className="max-w-3xl p-2 bg-black/95">
            <img src={mediaUrl} alt={mediaCaption || 'Imagen'} className="w-full h-auto max-h-[80vh] object-contain" />
            <a
              href={mediaUrl}
              download={mediaFilename || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-3 right-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 text-black text-xs font-medium hover:bg-white"
            >
              <Download className="w-3.5 h-3.5" /> Descargar
            </a>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Video
  if (type === 'video' && mediaUrl) {
    return (
      <div className={className}>
        <video src={mediaUrl} controls preload="metadata" className="rounded-lg max-w-[260px] max-h-[320px]" />
        {mediaCaption && <p className="text-xs mt-1 whitespace-pre-wrap break-words">{mediaCaption}</p>}
      </div>
    );
  }

  // Document
  if (type === 'document' && mediaUrl) {
    const isPdf = (mediaMime || '').includes('pdf') || (mediaFilename || '').toLowerCase().endsWith('.pdf');
    return (
      <div className={className}>
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={mediaFilename || undefined}
          className="flex items-center gap-2.5 p-2.5 rounded-lg bg-background/40 border border-border/40 hover:bg-background/60 transition-colors min-w-[200px] max-w-[260px]"
        >
          <div className="w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{mediaFilename || (isPdf ? 'Documento.pdf' : 'Documento')}</p>
            <p className="text-[10px] opacity-70">{formatBytes(mediaSize)}{mediaSize ? ' · ' : ''}{isPdf ? 'PDF' : (mediaMime || 'Archivo')}</p>
          </div>
          <Download className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </a>
        {mediaCaption && <p className="text-xs mt-1 whitespace-pre-wrap break-words">{mediaCaption}</p>}
      </div>
    );
  }

  // Media expected but URL missing → expired or failed
  if (['audio', 'voice', 'image', 'video', 'document', 'sticker'].includes(type) && !mediaUrl) {
    return (
      <div className={cn('flex items-center gap-2 text-xs opacity-80', className)}>
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Archivo expirado. Pedile al cliente que lo reenvíe.</span>
      </div>
    );
  }

  // Unsupported / other
  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <ImageIcon className="w-3.5 h-3.5 opacity-60" />
      <span>{body || 'Archivo recibido'}</span>
      {mediaUrl && (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">Descargar</a>
      )}
    </div>
  );
}
