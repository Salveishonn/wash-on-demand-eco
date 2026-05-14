import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, RefreshCw, Send, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BotmakerConversation {
  id: string;
  conversation_id: string;
  customer_phone: string | null;
  customer_name: string | null;
  channel: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_direction: string | null;
  unread_count: number;
  linked_booking_request_id: string | null;
  linked_booking_id: string | null;
}

interface BotmakerMessage {
  id: string;
  conversation_id: string;
  direction: string;
  sender: string | null;
  body: string | null;
  message_text?: string | null;
  sender_type?: string | null;
  raw_payload?: any;
  raw?: any;
  created_at: string;
}

export function BotmakerMessagesTab() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<BotmakerConversation[]>([]);
  const [selected, setSelected] = useState<BotmakerConversation | null>(null);
  const [messages, setMessages] = useState<BotmakerMessage[]>([]);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [canSendFromAdmin, setCanSendFromAdmin] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);

  const fetchConversations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("botmaker_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) toast.error("No se pudieron cargar las conversaciones");
    else setConversations((data ?? []) as BotmakerConversation[]);
    setLoading(false);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("botmaker_messages")
      .select("id,conversation_id,direction,sender,sender_type,body,message_text,raw,raw_payload,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) toast.error("No se pudieron cargar los mensajes");
    else setMessages((data ?? []) as BotmakerMessage[]);
  };

  const checkConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("botmaker-config-check", { body: {} });
      if (!error && (data as any)?.ok) setCanSendFromAdmin(Boolean((data as any).canSendFromAdmin));
    } catch { /* noop */ }
  };

  useEffect(() => { fetchConversations(); checkConfig(); }, []);
  useEffect(() => {
    if (selected) fetchMessages(selected.conversation_id);
    else setMessages([]);
  }, [selected?.conversation_id]);

  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      (c.customer_name ?? "").toLowerCase().includes(q) ||
      (c.customer_phone ?? "").toLowerCase().includes(q) ||
      (c.last_message_preview ?? "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("botmaker-send-message", {
        body: {
          conversation_id: selected.conversation_id,
          customer_phone: selected.customer_phone,
          text: reply.trim(),
        },
      });
      if (error || !(data as any)?.ok) {
        toast.error("No se pudo enviar el mensaje");
      } else {
        toast.success("Mensaje enviado");
        setReply("");
        fetchMessages(selected.conversation_id);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Mensajes / Botmaker</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchConversations}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-260px)] min-h-[420px]">
        {/* Conversation list */}
        <div className="md:col-span-1 bg-card border border-border rounded-xl p-3 flex flex-col overflow-hidden">
          <Input
            placeholder="Buscar por nombre, teléfono o texto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Sin conversaciones todavía.</p>
              <p className="text-xs text-amber-600">No Botmaker events received yet. Check webhook config.</p>
              <p className="text-xs text-muted-foreground">Si hay eventos inválidos, revisá Botmaker / Comunicaciones para confirmar si fueron rechazados por token mismatch.</p>
            </div>
          ) : (
            <div className="overflow-y-auto -mx-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors ${selected?.id === c.id ? "bg-muted" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{c.customer_name ?? c.customer_phone ?? c.conversation_id.slice(0, 8)}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{c.channel ?? "wa"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{c.last_message_preview ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(c.last_message_at).toLocaleString("es-AR")}</div>
                  {(c.linked_booking_request_id || c.linked_booking_id) && (
                    <div className="flex gap-1 mt-1">
                      {c.linked_booking_request_id && <Badge variant="secondary" className="text-[10px]">pedido</Badge>}
                      {c.linked_booking_id && <Badge variant="default" className="text-[10px]">reserva</Badge>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation detail */}
        <div className="md:col-span-2 bg-card border border-border rounded-xl p-3 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Elegí una conversación para ver el detalle.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{selected.customer_name ?? selected.customer_phone}</div>
                  <div className="text-xs text-muted-foreground truncate">{selected.customer_phone} · ID {selected.conversation_id}</div>
                  <div className="flex gap-1 mt-1">
                    {selected.linked_booking_request_id && <Badge variant="secondary" className="text-[10px]">booking_request vinculado</Badge>}
                    {selected.linked_booking_id && <Badge variant="default" className="text-[10px]">booking vinculado</Badge>}
                  </div>
                </div>
                <a
                  href={`https://go.botmaker.com/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary inline-flex items-center gap-1"
                >
                  Abrir en Botmaker <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sin mensajes registrados aún.</p>
                ) : (
                  messages.map((m) => {
                    const align = m.direction === "out" ? "justify-end" : m.direction === "event" ? "justify-center" : "justify-start";
                    const tone =
                      m.direction === "out" ? "bg-primary/10 text-foreground" :
                      m.direction === "event" ? "bg-muted text-muted-foreground text-[11px] italic" :
                      "bg-muted text-foreground";
                    const text = m.body ?? m.message_text ?? "—";
                    const raw = m.raw_payload ?? m.raw;
                    return (
                      <div key={m.id} className={`flex ${align}`}>
                        <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${tone}`}>
                          <div className="text-[10px] text-muted-foreground mb-1">{m.sender_type ?? m.sender ?? m.direction}</div>
                          <div className="whitespace-pre-wrap break-words">{text}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("es-AR")}</div>
                          {raw && (
                            <Collapsible>
                              <CollapsibleTrigger className="text-[10px] text-primary underline mt-1">raw payload</CollapsibleTrigger>
                              <CollapsibleContent>
                                <pre className="mt-1 max-h-44 overflow-auto rounded bg-background/80 p-2 text-[10px] text-muted-foreground">{JSON.stringify(raw, null, 2)}</pre>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border pt-2 mt-2">
                {canSendFromAdmin ? (
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Escribir respuesta…"
                      rows={2}
                      className="flex-1"
                    />
                    <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span>Para responder, configurá <code>BOTMAKER_API_TOKEN</code> y <code>BOTMAKER_BASE_URL</code>.</span>
                    <a href="https://go.botmaker.com/" target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">
                      Responder en Botmaker <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-3 text-xs text-muted-foreground">
        <strong>Nota:</strong> Botmaker es ahora el proveedor principal de mensajería. Los mensajes anteriores de la integración directa con Meta WhatsApp siguen disponibles en el panel <em>Legacy WhatsApp</em>.{" "}
        <button onClick={() => setShowLegacy((v) => !v)} className="underline text-primary">
          {showLegacy ? "Ocultar" : "Mostrar"} aviso legacy
        </button>
        {showLegacy && (
          <p className="mt-2">
            La pestaña anterior <em>Mensajes</em> usaba <code>whatsapp_conversations</code> y <code>whatsapp_messages</code>.
            Esos datos no se borran; solo dejan de ser la fuente principal.
          </p>
        )}
      </div>
    </div>
  );
}
