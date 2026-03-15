import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, MessageCircle, Loader2, ArrowLeft, Send, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AudioPlayer } from '@/components/ui/audio-player';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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
        .select('id, body, direction, status, created_at, message_type, media_mime_type, media_url')
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
    const textToSend = replyText.trim();
    
    // Optimistic message
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      body: textToSend,
      direction: 'outbound',
      status: 'queued',
      created_at: new Date().toISOString(),
      message_type: 'text',
      media_mime_type: null,
      media_url: null,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setReplyText('');

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
        body: {
          to_phone_e164: selectedConv.customer_phone_e164,
          body: textToSend,
          conversation_id: selectedConv.id,
        },
      });

      if (error) throw error;

      if (data?.ok && data?.message) {
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data.message : m));
      } else if (data?.stub) {
        // Stored but not sent (no WhatsApp configured)
        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...optimisticMsg, status: 'stored', id: data.message?.id || optimisticMsg.id } : m));
      } else {
        throw new Error(data?.error || 'Send failed');
      }

      console.log('[OpsMessages] Message sent:', { ok: data?.ok, provider: data?.stub ? 'stub' : 'meta', wa_id: data?.wa_message_id });
    } catch (err: any) {
      console.error('[OpsMessages] Send failed:', err);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setReplyText(textToSend);
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
                {(m.message_type === 'audio' || m.message_type === 'voice') ? (
                  <AudioPlayer url={m.media_url} mime={m.media_mime_type} />
                ) : m.media_url && (m.message_type === 'image') ? (
                  <img src={m.media_url} alt="Media" className="rounded-lg max-w-[200px] mb-1" />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.body || '📎 Media'}</p>
                )}
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
