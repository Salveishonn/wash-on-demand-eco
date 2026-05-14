import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageSquare, RefreshCw, ExternalLink, FlaskConical, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PUBLIC_PROBE_URL = 'https://www.washero.ar/';

interface BotmakerEvent {
  id: string;
  event_id: string | null;
  event_type: string;
  channel: string | null;
  conversation_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  processed: boolean;
  processing_error: string | null;
  created_at: string;
}

interface BookingRequest {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  service_type: string | null;
  botmaker_conversation_id: string | null;
  status: string;
  created_at: string;
}

interface BotmakerBooking {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  booking_date: string;
  booking_time: string;
  service_name: string;
  status: string;
  payment_status: string;
  botmaker_conversation_id: string | null;
  created_at: string;
}

interface BookingLog {
  id: string;
  conversation_id: string | null;
  customer_phone: string | null;
  result_status: string;
  booking_id: string | null;
  booking_request_id: string | null;
  error: string | null;
  created_at: string;
}

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/botmaker-webhook`;
const CREATE_BOOKING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/botmaker-create-booking`;

export function BotmakerTab() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<BotmakerEvent[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [botmakerBookings, setBotmakerBookings] = useState<BotmakerBooking[]>([]);
  const [bookingLogs, setBookingLogs] = useState<BookingLog[]>([]);
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [signatureCheck, setSignatureCheck] = useState<string>('-');
  const [webchatProbe, setWebchatProbe] = useState<{ checked: boolean; scriptFound: boolean; url: string } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulatingBooking, setSimulatingBooking] = useState(false);

  const load = async () => {
    setLoading(true);
    const [evts, reqs, bks, logs] = await Promise.all([
      supabase.from('botmaker_events').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('booking_requests').select('id,customer_name,customer_phone,address,preferred_date,preferred_time,service_type,botmaker_conversation_id,status,created_at').order('created_at', { ascending: false }).limit(15),
      supabase.from('bookings').select('id,customer_name,customer_phone,address,booking_date,booking_time,service_name,status,payment_status,botmaker_conversation_id,created_at').eq('booking_source', 'botmaker').order('created_at', { ascending: false }).limit(15),
      supabase.from('botmaker_booking_logs').select('id,conversation_id,customer_phone,result_status,booking_id,booking_request_id,error,created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    if (evts.error) toast.error('Error cargando eventos');
    else setEvents((evts.data ?? []) as BotmakerEvent[]);
    if (!reqs.error) setRequests((reqs.data ?? []) as BookingRequest[]);
    if (!bks.error) setBotmakerBookings((bks.data ?? []) as BotmakerBooking[]);
    if (!logs.error) setBookingLogs((logs.data ?? []) as BookingLog[]);
    setLoading(false);
  };

  const ping = async () => {
    try {
      const r = await fetch(WEBHOOK_URL, { method: 'GET' });
      if (r.ok) {
        const j = await r.json();
        setHealthStatus('ok');
        setSignatureCheck(j.auth_bm_token_check ?? j.signature_check ?? '-');
      } else {
        setHealthStatus('error');
      }
    } catch {
      setHealthStatus('error');
    }
  };

  const verifyWebchat = async () => {
    try {
      const res = await fetch(PUBLIC_PROBE_URL, { method: 'GET', mode: 'cors' });
      const html = await res.text();
      const found = html.includes('botmaker.com/rest/webchat') || html.includes('BotmakerWebchat');
      setWebchatProbe({ checked: true, scriptFound: found, url: PUBLIC_PROBE_URL });
      toast[found ? 'success' : 'warning'](
        found ? 'Webchat presente en el sitio público' : 'No se detectó el script en el HTML inicial (puede inyectarse en runtime)'
      );
    } catch {
      setWebchatProbe({ checked: true, scriptFound: false, url: PUBLIC_PROBE_URL });
      toast.error('No se pudo consultar el sitio público (CORS o red).');
    }
  };

  const simulateWebhookEvent = async () => {
    setSimulating(true);
    const fakeEventId = `sim-${Date.now()}`;
    const payload = {
      eventId: fakeEventId,
      eventType: 'message.user',
      channel: 'whatsapp',
      from: '5491100000000',
      customerName: 'Cliente Simulado',
      text: 'Quiero reservar un lavado para mañana en Nordelta',
      simulated: true,
    };
    const r = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSimulating(false);
    if (r.ok) {
      toast.success('Evento simulado enviado');
      load();
    } else {
      toast.warning('El webhook rechazó el evento (esperado si no se incluye auth-bm-token).');
    }
  };

  const simulateBookingFromBotmaker = async () => {
    setSimulatingBooking(true);
    try {
      const { data: tokenData, error: tokenErr } = await supabase.functions.invoke('botmaker-create-booking-simulate');
      if (tokenErr) {
        // Fallback: call directly without secret will be 401. We need a server simulator.
        // Use the convert helper below; for now just inform admin.
        toast.error('La simulación requiere el endpoint admin de simulación. Usá Botmaker para probar el flujo real.');
      } else {
        toast.success(`Simulación: ${tokenData?.status ?? 'ok'}`);
        load();
      }
    } catch (e: any) {
      toast.error(`Simulación falló: ${e?.message ?? 'unknown'}`);
    } finally {
      setSimulatingBooking(false);
    }
  };

  useEffect(() => { load(); ping(); }, []);

  const lastEvent = events[0];
  const lastError = events.find(e => e.processing_error);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Botmaker / Comunicaciones</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { load(); ping(); }}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusCard
          label="Webhook"
          value={healthStatus === 'ok' ? 'Online' : healthStatus === 'error' ? 'Offline' : '—'}
          tone={healthStatus === 'ok' ? 'ok' : healthStatus === 'error' ? 'err' : 'muted'}
        />
        <StatusCard
          label="Verificación token"
          value={signatureCheck}
          tone={signatureCheck === 'enabled' ? 'ok' : 'muted'}
        />
        <StatusCard
          label="Último evento"
          value={lastEvent ? new Date(lastEvent.created_at).toLocaleString('es-AR') : 'Sin eventos'}
          tone={lastEvent ? 'ok' : 'muted'}
        />
        <StatusCard
          label="Último error"
          value={lastError ? new Date(lastError.created_at).toLocaleString('es-AR') : 'Ninguno'}
          tone={lastError ? 'err' : 'ok'}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">URL del Webhook</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success('Copiado'); }}
          >
            Copiar
          </Button>
        </div>
        <code className="text-xs break-all text-muted-foreground">{WEBHOOK_URL}</code>
        <p className="text-xs text-muted-foreground mt-2">
          Header de seguridad esperado: <code>auth-bm-token</code> con el valor exacto de <code>BOTMAKER_WEBHOOK_SECRET</code>.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">URL de Reservas Botmaker</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { navigator.clipboard.writeText(CREATE_BOOKING_URL); toast.success('Copiado'); }}
          >
            Copiar
          </Button>
        </div>
        <code className="text-xs break-all text-muted-foreground">{CREATE_BOOKING_URL}</code>
        <p className="text-xs text-muted-foreground mt-2">
          Configurar como acción HTTP POST en Botmaker al final del flow de reserva. Incluir el header <code>auth-bm-token</code>.
        </p>
      </div>

      {/* Reservas desde WhatsApp */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Reservas desde WhatsApp</h3>
          </div>
          <Button variant="outline" size="sm" onClick={simulateBookingFromBotmaker} disabled={simulatingBooking}>
            <FlaskConical className="w-3.5 h-3.5 mr-1" />
            {simulatingBooking ? 'Simulando…' : 'Simular reserva desde Botmaker'}
          </Button>
        </div>
        {botmakerBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay reservas creadas desde Botmaker.</p>
        ) : (
          <div className="space-y-2">
            {botmakerBookings.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 text-xs border-b border-border/50 last:border-0 py-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{b.customer_name} · {b.customer_phone}</div>
                  <div className="text-muted-foreground truncate">
                    {b.booking_date} {b.booking_time} · {b.service_name} · {b.address ?? '—'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={b.status === 'pending' ? 'secondary' : 'default'}>{b.status}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleString('es-AR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pedidos pendientes */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Pedidos de reserva pendientes (booking_requests)</h3>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin pedidos pendientes.</p>
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-xs border-b border-border/50 last:border-0 py-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.customer_name ?? 'Sin nombre'} · {r.customer_phone}</div>
                  <div className="text-muted-foreground truncate">
                    {r.preferred_date ?? '?'} {r.preferred_time ?? ''} · {r.service_type ?? '—'} · {r.address ?? '—'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline">{r.status}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString('es-AR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs del endpoint de reservas */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Logs de reservas Botmaker</h3>
        {bookingLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin logs todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {bookingLogs.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-[11px] border-b border-border/50 last:border-0 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={l.result_status === 'booking_created' ? 'default' : l.error ? 'destructive' : 'secondary'} className="shrink-0">
                    {l.result_status}
                  </Badge>
                  <span className="text-muted-foreground truncate">
                    {l.customer_phone ?? '—'} {l.error ? `· ${l.error}` : ''}
                  </span>
                </div>
                <span className="text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString('es-AR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diagnostics webchat / events */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Diagnóstico Webchat & Eventos</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={verifyWebchat}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Verificar webchat
            </Button>
            <Button variant="outline" size="sm" onClick={simulateWebhookEvent} disabled={simulating}>
              <FlaskConical className="w-3.5 h-3.5 mr-1" />
              {simulating ? 'Enviando…' : 'Simular evento'}
            </Button>
          </div>
        </div>
        {webchatProbe && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>URL probada: <code>{webchatProbe.url}</code></div>
            <div>Script Botmaker en HTML: <Badge variant={webchatProbe.scriptFound ? 'secondary' : 'destructive'}>{webchatProbe.scriptFound ? 'detectado' : 'no detectado'}</Badge></div>
          </div>
        )}
      </div>

      {/* Eventos recientes */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Eventos recientes del webhook</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aún no se recibieron eventos.</p>
        ) : (
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-xs border-b border-border/50 last:border-0 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={e.processing_error ? 'destructive' : 'secondary'} className="shrink-0">
                    {e.event_type}
                  </Badge>
                  <span className="text-muted-foreground truncate">
                    {e.customer_name || e.customer_phone || e.conversation_id || '—'}
                  </span>
                </div>
                <span className="text-muted-foreground shrink-0">
                  {new Date(e.created_at).toLocaleString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botmaker flow instructions */}
      <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">Flow de reserva por WhatsApp (Botmaker)</p>
        <p>Crear estas variables en Botmaker y pedirlas en este orden:</p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li><code>customer_name</code> — "¿Cuál es tu nombre?"</li>
          <li><code>address</code> — "¿Cuál es la dirección donde querés el lavado?"</li>
          <li><code>neighborhood</code> — "¿En qué barrio o zona estás?"</li>
          <li><code>vehicle_type</code> — Auto / SUV / Pick-up / Otro</li>
          <li><code>service_type</code> — Lavado Básico / Lavado Completo / Otro</li>
          <li><code>preferred_date</code> — formato YYYY-MM-DD o "mañana"</li>
          <li><code>preferred_time</code> — formato HH:mm</li>
          <li><code>payment_method</code> — MercadoPago / Transferencia / Pagar después</li>
        </ol>
        <p className="mt-2">Luego llamar (acción HTTP POST):</p>
        <pre className="bg-background border border-border rounded p-2 overflow-x-auto text-[10px]">{`POST ${CREATE_BOOKING_URL}
Content-Type: application/json
auth-bm-token: <BOTMAKER_WEBHOOK_SECRET>

{
  "conversation_id": "{{conversation.id}}",
  "channel": "whatsapp",
  "customer_name": "{{customer_name}}",
  "customer_phone": "{{contact.phone}}",
  "address": "{{address}}",
  "neighborhood": "{{neighborhood}}",
  "vehicle_type": "{{vehicle_type}}",
  "service_type": "{{service_type}}",
  "preferred_date": "{{preferred_date}}",
  "preferred_time": "{{preferred_time}}",
  "payment_method": "{{payment_method}}",
  "notes": "{{notes}}"
}`}</pre>
        <p>Manejo de respuesta según <code>status</code>: <code>booking_created</code> → mostrar <code>message</code>; <code>needs_review</code> → mostrar <code>message</code>; <code>slot_unavailable</code> → pedir otro horario; <code>missing_data</code> → pedir <code>missing_fields</code>; <code>duplicate</code> → ofrecer derivar a humano.</p>
      </div>
    </div>
  );
}

function StatusCard({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'err' | 'muted' }) {
  const dot =
    tone === 'ok' ? 'bg-green-500' : tone === 'err' ? 'bg-destructive' : 'bg-muted-foreground/40';
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-sm font-semibold truncate">{value}</span>
      </div>
    </div>
  );
}
