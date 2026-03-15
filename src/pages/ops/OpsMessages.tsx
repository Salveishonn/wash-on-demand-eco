import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, MessageCircle, Loader2, ArrowLeft, Send, AlertTriangle, Mic, Play, Pause, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/* ── Inline Audio Player (mobile-optimized) ── */
function OpsAudioPlayer({ url, mime }: { url?: string | null; mime?: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  if (!url) {
    return (
      <div className="flex items-center gap-2 py-1">
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
    } else {
      setIsLoading(true);
      try { await audio.play(); } catch { setError(true); }
      setIsLoading(false);
    }
  };

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  if (error) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs opacity-70 flex items-center gap-1.5"><Mic className="w-3.5 h-3.5" /> No se pudo reproducir</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          <Download className="w-3 h-3" /> Descargar audio
        </a>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[180px] max-w-[260px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onError={() => setError(true)}
      />
      <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center flex-shrink-0 transition-colors active:scale-95">
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-2 bg-primary/10 rounded-full cursor-pointer overflow-hidden" onClick={handleSeek}>
          <div className="h-full bg-primary/60 rounded-full transition-[width] duration-100" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] opacity-60">{currentTime > 0 ? fmtDur(currentTime) : '0:00'}</span>
          <span className="text-[10px] opacity-60">{duration > 0 ? fmtDur(duration) : '—'}</span>
        </div>
      </div>
    </div>
  );
}

interface Conversation {
  id: string;
  customer_phone_e164: string;
  customer_name: string | null;
  last_message_preview: string | null;
  last_message_at: string;
  last_inbound_at: string | null;
  last_admin_seen_at: string | null;
  is_open: boolean;
}

interface ChatMessage {
  id: string;
  body: string;
  direction: string;
  status: string;
  created_at: string;
  message_type: string;
  media_mime_type: string | null;
  media_url: string | null;
}

export default function OpsMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadConversations = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from('whatsapp_conversations')
          .select('id, customer_phone_e164, customer_name, last_message_preview, last_message_at, last_inbound_at, last_admin_seen_at, is_open')
          .order('last_message_at', { ascending: false })
          .limit(100);

        if (error) {
          console.warn('[OpsMessages] Load error:', error);
          setLoadError('No se pudieron cargar las conversaciones');
          setConversations([]);
        } else {
          setConversations((data || []) as Conversation[]);
        }
      } catch (err) {
        console.warn('[OpsMessages] Unexpected error:', err);
        setLoadError('Error de conexión');
        setConversations([]);
      }
      setIsLoading(false);
    };
    loadConversations();
  }, []);

  const loadChat = useCallback(async (conv: Conversation) => {
    setChatLoading(true);
    setSelectedConv(conv);

    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, body, direction, status, created_at, message_type, media_mime_type')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.warn('[OpsMessages] Chat load error:', error);
      }
      setMessages((data || []) as ChatMessage[]);
    } catch (err) {
      console.warn('[OpsMessages] Chat error:', err);
      setMessages([]);
    }
    setChatLoading(false);

    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 100);
  }, []);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConv || sending) return;
    setSending(true);
    try {
      await supabase.functions.invoke('whatsapp-send-text', {
        body: { to: selectedConv.customer_phone_e164, message: replyText.trim() },
      });
      setReplyText('');
      loadChat(selectedConv);
    } catch (err) {
      console.error('Send failed:', err);
    }
    setSending(false);
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.customer_phone_e164 || '').includes(q) || (c.customer_name || '').toLowerCase().includes(q) || (c.last_message_preview || '').toLowerCase().includes(q);
  });

  const isUnread = (c: Conversation) => {
    if (!c.last_inbound_at) return false;
    if (!c.last_admin_seen_at) return true;
    return c.last_inbound_at > c.last_admin_seen_at;
  };

  const quickReplies = [
    '¡Hola! Soy de Washero 🚗',
    'Ya estamos en camino 🚗💨',
    'Llegamos en 10 minutos ⏱️',
    'Tu auto está listo ✨',
    '¡Gracias por confiar en Washero! 🙌',
  ];

  const formatTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'HH:mm');
    } catch {
      return '';
    }
  };

  const formatDistance = (dateStr: string) => {
    try {
      return formatDistanceToNow(parseISO(dateStr), { addSuffix: false, locale: es });
    } catch {
      return '';
    }
  };

  // Chat view
  if (selectedConv) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="bg-card border-b border-border px-3 py-3 flex items-center gap-3 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedConv(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{selectedConv.customer_name || selectedConv.customer_phone_e164}</p>
            <p className="text-[10px] text-muted-foreground">{selectedConv.customer_phone_e164}</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {chatLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sin mensajes</div>
          ) : messages.map(m => (
            <div key={m.id} className={cn("flex", m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                m.direction === 'outbound'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-card border border-border text-foreground rounded-bl-md'
              )}>
                <p className="whitespace-pre-wrap break-words">{m.body || '📎 Media'}</p>
                <p className={cn("text-[10px] mt-1 text-right", m.direction === 'outbound' ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-1.5 overflow-x-auto flex gap-1.5 shrink-0">
          {quickReplies.map(qr => (
            <button key={qr} onClick={() => setReplyText(qr)} className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 border border-border">
              {qr}
            </button>
          ))}
        </div>

        <div className="bg-card border-t border-border px-3 py-2 flex items-center gap-2 shrink-0">
          <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Escribir mensaje..." className="flex-1 h-10" onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()} />
          <Button size="icon" className="h-10 w-10 shrink-0" disabled={!replyText.trim() || sending} onClick={sendReply}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // Conversation list
  return (
    <div className="px-4 py-4 space-y-4">
      <h2 className="text-lg font-display font-bold text-foreground">Mensajes</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversación..." className="pl-9 h-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : loadError ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-yellow-500 opacity-60" />
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <p className="text-xs text-muted-foreground mt-1">Las conversaciones de WhatsApp se mostrarán cuando estén disponibles.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin conversaciones</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(c => {
            const unread = isUnread(c);
            return (
              <button
                key={c.id}
                onClick={() => loadChat(c)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-washero-charcoal flex items-center justify-center shrink-0">
                  <span className="text-primary text-sm font-bold">
                    {(c.customer_name || c.customer_phone_e164 || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={cn("text-sm truncate", unread ? "font-bold text-foreground" : "font-medium text-foreground")}>
                      {c.customer_name || c.customer_phone_e164}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {formatDistance(c.last_message_at)}
                    </span>
                  </div>
                  <p className={cn("text-xs truncate mt-0.5", unread ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {c.last_message_preview || '...'}
                  </p>
                </div>
                {unread && <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
