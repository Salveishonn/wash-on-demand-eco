import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AudioPlayer } from '@/components/ui/audio-player';
import {
  Search,
  Send,
  Loader2,
  MessageCircle,
  Check,
  CheckCheck,
  Clock,
  XCircle,
  User,
  Phone,
  Truck,
  Timer,
  CheckCircle,
  CalendarX,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Conversation {
  id: string;
  customer_phone_e164: string;
  customer_name: string | null;
  last_message_preview: string | null;
  last_message_at: string;
  last_inbound_at: string | null;
  is_open: boolean;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  created_at: string;
  error: string | null;
  message_type?: string;
  media_url?: string | null;
  media_mime_type?: string | null;
}

// Quick actions mapped to smart-send action types
const QUICK_ACTIONS = [
  { label: 'En camino 🚐', icon: Truck, action: 'on_the_way' },
  { label: '10 min ⏱️', icon: Timer, action: 'arriving_10_min' },
  { label: 'Llegamos ✅', icon: CheckCircle, action: 'arrived' },
  { label: 'Reprogramar 📅', icon: CalendarX, action: 'reschedule' },
];

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeDate = (date: string) => {
  const now = new Date();
  const msgDate = new Date(date);
  const diffMs = now.getTime() - msgDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return formatTime(date);
  } else if (diffDays === 1) {
    return 'Ayer';
  } else if (diffDays < 7) {
    return msgDate.toLocaleDateString('es-AR', { weekday: 'short' });
  } else {
    return msgDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'queued':
      return <Clock className="w-3 h-3 text-muted-foreground" />;
    case 'sent':
      return <Check className="w-3 h-3 text-muted-foreground" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    case 'read':
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    case 'failed':
      return <XCircle className="w-3 h-3 text-red-500" />;
    default:
      return null;
  }
};

export function MessagesTab() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea helper
  const autoResizeTextarea = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const [sendingAction, setSendingAction] = useState<string | null>(null);

  // Load conversations with last_inbound_at for 24h window tracking
  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('id, customer_phone_e164, customer_name, last_message_preview, last_message_at, last_inbound_at, is_open')
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      
      const conversationsWithUnread = (data || []).map(c => ({
        ...c,
        unread_count: 0,
      }));
      
      setConversations(conversationsWithUnread);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las conversaciones',
      });
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Load messages for selected conversation
  const fetchMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      setMessages((data as Message[]) || []);

      // Mark as seen
      await supabase
        .from('whatsapp_conversations')
        .update({ last_admin_seen_at: new Date().toISOString() })
        .eq('id', conversationId);

      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los mensajes',
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Optional realtime
  useEffect(() => {
    let messagesChannel: ReturnType<typeof supabase.channel> | null = null;
    let conversationsChannel: ReturnType<typeof supabase.channel> | null = null;

    try {
      messagesChannel = supabase
        .channel('whatsapp-messages-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'whatsapp_messages' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new as Message;
              if (selectedConversation && newMsg.conversation_id === selectedConversation.id) {
                setMessages(prev => [...prev, newMsg]);
              }
              fetchConversations();
            } else if (payload.eventType === 'UPDATE') {
              const updatedMsg = payload.new as Message;
              setMessages(prev =>
                prev.map(m => (m.id === updatedMsg.id ? updatedMsg : m))
              );
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[MessagesTab] Realtime unavailable, using polling');
            if (messagesChannel) supabase.removeChannel(messagesChannel);
          }
        });

      conversationsChannel = supabase
        .channel('whatsapp-conversations-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'whatsapp_conversations' },
          () => fetchConversations()
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[MessagesTab] Conversations realtime unavailable');
            if (conversationsChannel) supabase.removeChannel(conversationsChannel);
          }
        });
    } catch (e) {
      console.warn('[MessagesTab] Realtime setup failed, using polling:', e);
    }

    const pollInterval = setInterval(() => {
      fetchConversations();
      if (selectedConversation) fetchMessages(selectedConversation.id);
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (conversationsChannel) supabase.removeChannel(conversationsChannel);
    };
  }, [selectedConversation?.id]);

  // Send message
  const handleSend = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const textToSend = messageText.trim();
    setMessageText('');
    if (composerRef.current) {
      composerRef.current.style.height = 'auto';
    }
    setIsSending(true);

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      direction: 'outbound',
      body: textToSend,
      status: 'queued',
      created_at: new Date().toISOString(),
      error: null,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-whatsapp-send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: selectedConversation.id,
            to: selectedConversation.customer_phone_e164,
            body: textToSend,
          }),
        }
      );

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Failed to send');
      }

      if (result.message) {
        setMessages(prev =>
          prev.map(m => (m.id === optimisticMsg.id ? result.message : m))
        );
      }

      if (result.stub || result.provider === 'stub') {
        setConfigWarning('WhatsApp no configurado. Los mensajes se guardan pero no se envían.');
        toast({
          title: 'Mensaje guardado',
          description: 'WhatsApp no configurado - mensaje almacenado localmente',
          variant: 'default',
        });
      } else {
        setConfigWarning(null);
        toast({
          title: 'Mensaje enviado ✅',
          description: `Enviado vía ${result.provider === 'meta' ? 'Meta WhatsApp' : 'WhatsApp'}`,
        });
      }

      fetchConversations();
    } catch (error: any) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setMessageText(textToSend);
      
      if (error.message?.includes('META_') || error.message?.includes('outside 24h')) {
        setConfigWarning('Error: Fuera de la ventana de 24h. Use una plantilla aprobada.');
      }
      
      toast({
        variant: 'destructive',
        title: 'Error al enviar',
        description: error.message || 'No se pudo enviar el mensaje',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle quick action
  const handleQuickAction = async (action: string) => {
    if (!selectedConversation) return;
    
    setSendingAction(action);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-smart-send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: selectedConversation.customer_phone_e164,
            action: action,
            customer_name: selectedConversation.customer_name || 'Cliente',
            conversation_id: selectedConversation.id,
          }),
        }
      );

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to send');
      }

      const templateInfo = result.used_template 
        ? `(Template: ${result.template_name})` 
        : '(Texto libre)';
      
      toast({
        title: 'Mensaje enviado ✅',
        description: `Enviado ${templateInfo}`,
      });

      fetchMessages(selectedConversation.id);
      fetchConversations();
    } catch (error: any) {
      console.error('Error sending quick action:', error);
      
      if (error.message?.includes('Fuera de ventana')) {
        setConfigWarning('El cliente debe responder primero para abrir la ventana de 24h');
      }
      
      toast({
        variant: 'destructive',
        title: 'Error al enviar',
        description: error.message || 'No se pudo enviar el mensaje',
      });
    } finally {
      setSendingAction(null);
    }
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      c =>
        c.customer_phone_e164.includes(query) ||
        c.customer_name?.toLowerCase().includes(query) ||
        c.last_message_preview?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const isWithin24h = useMemo(() => {
    if (!selectedConversation?.last_inbound_at) return false;
    const diff = Date.now() - new Date(selectedConversation.last_inbound_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }, [selectedConversation?.last_inbound_at]);
  
  const lastInboundDisplay = useMemo(() => {
    if (!selectedConversation?.last_inbound_at) return 'Nunca';
    const date = new Date(selectedConversation.last_inbound_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours < 24) {
      return `Hace ${diffHours}h ${diffMins}m`;
    }
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }, [selectedConversation?.last_inbound_at]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)] min-h-[400px]"
    >
      {/* Config Warning Banner */}
      {configWarning && (
        <Alert variant="destructive" className="mb-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuración</AlertTitle>
          <AlertDescription className="text-xs">{configWarning}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex flex-1 bg-background rounded-xl shadow-sm overflow-hidden border border-border/50">
      {/* Left: Conversations List */}
      <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-border flex-col`}>
        {/* Search */}
        <div className="p-3 border-b border-border bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageCircle className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {searchQuery ? 'Sin resultados' : 'No hay conversaciones'}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {searchQuery ? 'Intentá con otro término' : 'Las conversaciones aparecerán aquí'}
              </p>
            </div>
          ) : (
            <div>
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-3 sm:p-3.5 text-left transition-colors border-b border-border/30 min-h-[64px] ${
                    selectedConversation?.id === conv.id 
                      ? 'bg-primary/5 border-l-2 border-l-primary' 
                      : 'hover:bg-muted/40 active:bg-muted/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">
                          {conv.customer_name || conv.customer_phone_e164}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {formatRelativeDate(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate leading-relaxed">
                          {conv.last_message_preview || 'Sin mensajes'}
                        </p>
                        {conv.unread_count > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center text-[10px]">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Chat */}
      <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b border-border flex items-center justify-between gap-2 bg-muted/10">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Back button on mobile */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 md:hidden shrink-0"
                  onClick={() => setSelectedConversation(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </Button>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {selectedConversation.customer_name || selectedConversation.customer_phone_e164}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span className="truncate">{selectedConversation.customer_phone_e164}</span>
                  </div>
                </div>
              </div>
              <Badge variant={isWithin24h ? 'default' : 'secondary'} className={`text-[10px] shrink-0 ${isWithin24h ? 'bg-green-500' : 'bg-yellow-500'}`}>
                {isWithin24h ? '24h ✓' : 'Plantilla'}
              </Badge>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3 sm:p-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No hay mensajes en esta conversación</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <AnimatePresence mode="popLayout">
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 ${
                            msg.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted rounded-bl-sm'
                          }`}
                        >
                          {/* Audio player for voice notes */}
                          {(msg.message_type === 'audio' || msg.message_type === 'voice') ? (
                            <AudioPlayer url={msg.media_url} mime={msg.media_mime_type} />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          )}
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            msg.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                            {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                          </div>
                          {msg.error && msg.error !== 'TWILIO_NOT_CONFIGURED_STUB' && (
                            <p className="text-xs text-red-300 mt-1">{msg.error}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Quick Actions */}
            <div className="px-3 py-2 border-t border-border bg-muted/10">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Último msg:</span>
                <Badge variant="outline" className="text-[10px] h-5">{lastInboundDisplay}</Badge>
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                {QUICK_ACTIONS.map((qa) => (
                  <Button
                    key={qa.action}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(qa.action)}
                    disabled={sendingAction === qa.action}
                    className="text-[11px] h-8 px-2.5 shrink-0"
                  >
                    {sendingAction === qa.action ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <qa.icon className="w-3 h-3 mr-1" />
                    )}
                    {qa.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Composer */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={composerRef}
                  placeholder="Escribe un mensaje..."
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    autoResizeTextarea(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[44px] max-h-[200px] resize-none overflow-y-auto text-sm"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || isSending}
                  className="px-3 shrink-0 h-11 w-11"
                  size="icon"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold mb-1.5">Mensajes WhatsApp</h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Seleccioná una conversación para ver los mensajes y responder.
            </p>
          </div>
        )}
      </div>
    </div>
    </motion.div>
  );
}
