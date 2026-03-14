import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, MessageCircle, ChevronRight, Loader2, ArrowLeft, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Conversation {
  phone: string;
  name: string | null;
  lastMessage: string;
  lastMessageAt: string;
  direction: string;
  unread: boolean;
}

interface ChatMessage {
  id: string;
  from_phone: string | null;
  to_phone: string | null;
  body: string | null;
  direction: string;
  status: string | null;
  created_at: string;
  media_type: string | null;
}

export default function OpsMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch conversation list
  useEffect(() => {
    setIsLoading(true);
    supabase
      .from('whatsapp_messages')
      .select('from_phone, to_phone, body, direction, status, created_at, profile_name')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) { setIsLoading(false); return; }

        // Group by phone number
        const convMap = new Map<string, Conversation>();
        for (const msg of data as any[]) {
          const phone = msg.direction === 'inbound' ? msg.from_phone : msg.to_phone;
          if (!phone) continue;
          if (!convMap.has(phone)) {
            convMap.set(phone, {
              phone,
              name: msg.profile_name || null,
              lastMessage: msg.body || '📎 Media',
              lastMessageAt: msg.created_at,
              direction: msg.direction,
              unread: msg.direction === 'inbound' && msg.status !== 'read',
            });
          }
        }
        
        setConversations(Array.from(convMap.values()));
        setIsLoading(false);
      });
  }, []);

  // Fetch chat for selected phone
  const loadChat = useCallback(async (phone: string) => {
    setChatLoading(true);
    setSelectedPhone(phone);
    
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('id, from_phone, to_phone, body, direction, status, created_at, media_type')
      .or(`from_phone.eq.${phone},to_phone.eq.${phone}`)
      .order('created_at', { ascending: true })
      .limit(100);

    setMessages((data || []) as ChatMessage[]);
    setChatLoading(false);
    
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 100);
  }, []);

  // Send reply
  const sendReply = async () => {
    if (!replyText.trim() || !selectedPhone || sending) return;
    setSending(true);

    try {
      await supabase.functions.invoke('whatsapp-send-text', {
        body: { to: selectedPhone, message: replyText.trim() },
      });
      setReplyText('');
      loadChat(selectedPhone);
    } catch (err) {
      console.error('Send failed:', err);
    }
    setSending(false);
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.phone.includes(q) || c.name?.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q);
  });

  // Quick reply templates
  const quickReplies = [
    '¡Hola! Soy de Washero 🚗',
    'Ya estamos en camino 🚗💨',
    'Llegamos en 10 minutos ⏱️',
    'Tu auto está listo ✨',
    '¡Gracias por confiar en Washero! 🙌',
  ];

  // Chat view
  if (selectedPhone) {
    const conv = conversations.find(c => c.phone === selectedPhone);
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Chat header */}
        <div className="bg-card border-b border-border px-3 py-3 flex items-center gap-3 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedPhone(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{conv?.name || selectedPhone}</p>
            <p className="text-[10px] text-muted-foreground">{selectedPhone}</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {chatLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
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
                  {format(parseISO(m.created_at), 'HH:mm')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick replies */}
        <div className="px-3 py-1.5 overflow-x-auto flex gap-1.5 shrink-0">
          {quickReplies.map(qr => (
            <button
              key={qr}
              onClick={() => setReplyText(qr)}
              className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
            >
              {qr}
            </button>
          ))}
        </div>

        {/* Reply input */}
        <div className="bg-card border-t border-border px-3 py-2 flex items-center gap-2 shrink-0">
          <Input 
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Escribir mensaje..."
            className="flex-1 h-10"
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
          />
          <Button 
            size="icon" 
            className="h-10 w-10 shrink-0" 
            disabled={!replyText.trim() || sending}
            onClick={sendReply}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // Conversation list view
  return (
    <div className="px-4 py-4 space-y-4">
      <h2 className="text-lg font-display font-bold text-foreground">Mensajes</h2>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar conversación..."
          className="pl-9 h-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin conversaciones</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(c => (
            <button
              key={c.phone}
              onClick={() => loadChat(c.phone)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-washero-charcoal flex items-center justify-center shrink-0">
                <span className="text-primary text-sm font-bold">
                  {(c.name || c.phone).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={cn("text-sm truncate", c.unread ? "font-bold text-foreground" : "font-medium text-foreground")}>
                    {c.name || c.phone}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {formatDistanceToNow(parseISO(c.lastMessageAt), { addSuffix: false, locale: es })}
                  </span>
                </div>
                <p className={cn("text-xs truncate mt-0.5", c.unread ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {c.direction === 'outbound' && '↪ '}{c.lastMessage}
                </p>
              </div>
              {c.unread && <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
