import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Conversation {
  id: string;
  customer_phone_e164: string;
  customer_name: string | null;
  last_message_preview: string | null;
  last_message_at: string;
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
}

const QUICK_ACTIONS = [
  { label: 'Estamos en camino 🚐', icon: Truck, message: 'Hola! Somos Washero 🚐 Estamos en camino hacia tu ubicación. ¡Llegamos pronto!' },
  { label: 'Llegamos en 10 min ⏱️', icon: Timer, message: 'Hola! Te avisamos que estamos a 10 minutos de llegar. ¡Preparate!' },
  { label: 'Ya llegamos ✅', icon: CheckCircle, message: 'Hola! Ya llegamos a tu ubicación. ¿Dónde podemos estacionar?' },
  { label: 'Reprogramar 📅', icon: CalendarX, message: 'Hola! Lamentamos informarte que necesitamos reprogramar tu turno. ¿Qué horario te queda mejor?' },
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

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load conversations
  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations_v')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
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

      // Update local state
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

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, []);

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscriptions
  useEffect(() => {
    const messagesChannel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        (payload) => {
          console.log('[MessagesTab] Realtime message update:', payload);
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            if (selectedConversation && newMsg.conversation_id === selectedConversation.id) {
              setMessages(prev => [...prev, newMsg]);
            }
            // Refresh conversations to update preview
            fetchConversations();
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages(prev =>
              prev.map(m => (m.id === updatedMsg.id ? updatedMsg : m))
            );
          }
        }
      )
      .subscribe();

    const conversationsChannel = supabase
      .channel('whatsapp-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [selectedConversation?.id]);

  // Send message
  const handleSend = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const textToSend = messageText.trim();
    setMessageText('');
    setIsSending(true);

    // Optimistic update
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

      // Replace optimistic message with real one
      if (result.message) {
        setMessages(prev =>
          prev.map(m => (m.id === optimisticMsg.id ? result.message : m))
        );
      }

      if (result.stub) {
        toast({
          title: 'Mensaje guardado',
          description: 'Twilio no configurado - mensaje almacenado localmente',
        });
      } else {
        toast({
          title: 'Mensaje enviado ✅',
          description: 'WhatsApp enviado correctamente',
        });
      }

      // Refresh conversations
      fetchConversations();
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setMessageText(textToSend); // Restore text
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo enviar el mensaje',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle quick action
  const handleQuickAction = (message: string) => {
    setMessageText(message);
  };

  // Filter conversations
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

  // Check if within 24h window
  const isWithin24h = useMemo(() => {
    if (!selectedConversation || messages.length === 0) return false;
    const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');
    if (!lastInbound) return false;
    const diff = Date.now() - new Date(lastInbound.created_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }, [messages, selectedConversation]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-[calc(100vh-280px)] min-h-[500px] bg-background rounded-xl shadow-sm overflow-hidden border border-border"
    >
      {/* Left: Conversations List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones aún'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {conv.customer_name || conv.customer_phone_e164}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatRelativeDate(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.last_message_preview || 'Sin mensajes'}
                        </p>
                        {conv.unread_count > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center text-xs">
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
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">
                    {selectedConversation.customer_name || selectedConversation.customer_phone_e164}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    {selectedConversation.customer_phone_e164}
                  </div>
                </div>
              </div>
              <Badge variant={isWithin24h ? 'default' : 'secondary'} className={isWithin24h ? 'bg-green-500' : 'bg-yellow-500'}>
                {isWithin24h ? 'Ventana 24h' : 'Requiere plantilla'}
              </Badge>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
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
                <div className="space-y-3">
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
                          className={`max-w-[70%] rounded-lg px-3 py-2 ${
                            msg.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            msg.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            <span className="text-xs">{formatTime(msg.created_at)}</span>
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
            <div className="px-4 py-2 border-t border-border">
              <div className="flex gap-2 flex-wrap">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action.message)}
                    className="text-xs"
                  >
                    <action.icon className="w-3 h-3 mr-1" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Composer */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Escribe un mensaje..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[44px] max-h-32 resize-none"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || isSending}
                  className="px-4"
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
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Mensajes WhatsApp</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Selecciona una conversación para ver los mensajes o envía un nuevo mensaje desde una reserva.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
