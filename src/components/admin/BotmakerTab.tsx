import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageSquare, RefreshCw, ExternalLink, FlaskConical, Calendar, Activity, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Diagnostic { key: string; value_text: string | null; value_at: string | null; }

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
  is_test: boolean | null;
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
  const [hideTestRequests, setHideTestRequests] = useState(true);
  const [diagnostics, setDiagnostics] = useState<Record<string, Diagnostic>>({});
  const [conversationCount, setConversationCount] = useState<number>(0);
  const [rawDialog, setRawDialog] = useState<any | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [evts, reqs, bks, logs, diag, convCount] = await Promise.all([
      supabase.from('botmaker_events').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('booking_requests').select('id,customer_name,customer_phone,address,preferred_date,preferred_time,service_type,botmaker_conversation_id,status,is_test,created_at').order('created_at', { ascending: false }).limit(30),
      supabase.from('bookings').select('id,customer_name,customer_phone,address,booking_date,booking_time,service_name,status,payment_status,botmaker_conversation_id,created_at').or('booking_source.eq.botmaker,communication_channel.eq.whatsapp,created_from.eq.botmaker').order('created_at', { ascending: false }).limit(15),
      supabase.from('botmaker_booking_logs').select('id,conversation_id,customer_phone,result_status,booking_id,booking_request_id,error,created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('botmaker_diagnostics').select('*'),
      supabase.from('botmaker_conversations').select('id', { count: 'exact', head: true }),
    ]);
    if (evts.error) toast.error('Error cargando eventos');
    else setEvents((evts.data ?? []) as BotmakerEvent[]);
    if (!reqs.error) setRequests((reqs.data ?? []) as BookingRequest[]);
    if (!bks.error) setBotmakerBookings((bks.data ?? []) as BotmakerBooking[]);
    if (!logs.error) setBookingLogs((logs.data ?? []) as BookingLog[]);
    if (!diag.error) {
      const map: Record<string, Diagnostic> = {};
      (diag.data ?? []).forEach((d: any) => { map[d.key] = d; });
      setDiagnostics(map);
    }
    setConversationCount(convCount.count ?? 0);
    setLoading(false);
  };

  const runWebhookTest = async (mode: 'with_token' | 'without_token' | 'summary_and_confirm') => {
    const { data, error } = await supabase.functions.invoke('botmaker-test-webhook', { body: { mode } });
    if (error) { toast.error(`Test falló: ${error.message}`); return; }
    const status = (data as any)?.upstream_status;
    if (mode === 'without_token') {
      status === 401 ? toast.success('Seguridad OK: webhook rechazó sin token (401).') : toast.error(`Esperaba 401, recibió ${status}.`);
    } else if (mode === 'with_token') {
      status && status < 400 ? toast.success(`Webhook OK con token (${status}).`) : toast.error(`Webhook falló con token (${status}).`);
    } else {
      const reqId = (data as any)?.booking_request_id;
      reqId ? toast.success(`Booking request de prueba creado: ${String(reqId).slice(0, 8)}`) : toast.warning('Simulación enviada, revisá pedidos.');
    }
    load();
  };

  const updateRequest = async (id: string, action: 'request_more_info' | 'reject' | 'toggle_test', reason?: string) => {
    setBusyRequestId(id);
    try {
      const { data, error } = await supabase.functions.invoke('botmaker-update-request', { body: { request_id: id, action, reason } });
      if (error || !(data as any)?.ok) {
        toast.error((data as any)?.error ?? error?.message ?? 'No se pudo actualizar');
      } else {
        toast.success('Pedido actualizado');
        load();
      }
    } finally { setBusyRequestId(null); }
  };

  const viewRawPayload = async (id: string) => {
    const { data, error } = await supabase
      .from('booking_requests')
      .select('id,customer_name,parsed_data,missing_fields,parsing_warnings,raw_payload,status,is_test,created_at')
      .eq('id', id).maybeSingle();
    if (error || !data) { toast.error('No se pudo cargar el payload'); return; }
    setRawDialog(data);
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

  const simulateWebhookEvent = async (mode: 'authenticated' | 'unauthenticated') => {
    setSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke('botmaker-simulate-event', {
        body: { mode },
      });
      if (error) {
        toast.error(`Simulación falló: ${error.message ?? 'error desconocido'}`);
        return;
      }
      const status = (data as any)?.upstream_status;
      const ok = (data as any)?.ok;
      if (mode === 'unauthenticated') {
        if (status === 401) {
          toast.success(`Security test passed: webhook rejected unauthenticated request (HTTP 401).`);
        } else {
          toast.error(`Security test FAILED: webhook returned HTTP ${status}, expected 401.`);
        }
      } else {
        if (ok && status && status < 400) {
          toast.success(`Evento autenticado aceptado por el webhook (HTTP ${status}).`);
        } else {
          toast.error(`Webhook rechazó el evento autenticado (HTTP ${status}). Verificá BOTMAKER_WEBHOOK_SECRET.`);
        }
      }
      load();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setSimulating(false);
    }
  };

  const simulateBookingFromBotmaker = async () => {
    setSimulatingBooking(true);
    try {
      const { data, error } = await supabase.functions.invoke('botmaker-create-booking-simulate', {
        body: {},
      });
      if (error) {
        toast.error(`Simulación falló: ${error.message ?? 'error desconocido'}`);
      } else {
        const result = (data as any)?.result ?? {};
        const status = result.status ?? (data as any)?.status ?? 'ok';
        const detail =
          result.booking_id ? `booking ${String(result.booking_id).slice(0, 8)}` :
          result.request_id ? `pedido ${String(result.request_id).slice(0, 8)}` :
          result.message ?? '';
        const label = `Simulación: ${status}${detail ? ` · ${detail}` : ''}`;
        if (status === 'booking_created') toast.success(label);
        else if (status === 'needs_review') toast.warning(label);
        else if (status === 'error') toast.error(label);
        else toast.message(label);
        await load();
      }
    } catch (e: any) {
      toast.error(`Simulación falló: ${e?.message ?? 'unknown'}`);
    } finally {
      setSimulatingBooking(false);
    }
  };

  const markRequestAsTest = async (id: string, isTest: boolean) => {
    const { error } = await supabase.from('booking_requests').update({ is_test: isTest }).eq('id', id);
    if (error) toast.error('No se pudo actualizar');
    else { toast.success(isTest ? 'Marcado como test' : 'Marcado como real'); load(); }
  };

  const approveRequest = async (id: string) => {
    const { data, error } = await supabase.functions.invoke('botmaker-convert-request', {
      body: { request_id: id },
    });
    if (error || !(data as any)?.ok) {
      const msg = (data as any)?.error ?? error?.message ?? 'error';
      const missing = (data as any)?.missing;
      toast.error(`No se pudo aprobar: ${msg}${missing ? ` (faltan: ${missing.join(', ')})` : ''}`);
    } else {
      toast.success('Reserva creada desde el pedido');
      load();
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

      {/* Diagnóstico Botmaker */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Diagnóstico Botmaker</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => runWebhookTest('without_token')}>
              Test sin token (esperado 401)
            </Button>
            <Button variant="outline" size="sm" onClick={() => runWebhookTest('with_token')}>
              Test con token
            </Button>
            <Button variant="default" size="sm" onClick={() => runWebhookTest('summary_and_confirm')}>
              <FlaskConical className="w-3.5 h-3.5 mr-1" /> Simular resumen + confirmación
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          <DiagRow label="Conversaciones almacenadas" value={String(conversationCount)} />
          <DiagRow label="Último webhook válido" value={fmtDiag(diagnostics['last_valid_webhook'])} />
          <DiagRow label="Último webhook inválido" value={fmtDiag(diagnostics['last_invalid_webhook'])} />
          <DiagRow label="Última conversación" value={fmtDiag(diagnostics['last_conversation_stored'])} />
          <DiagRow label="Último resumen detectado" value={fmtDiag(diagnostics['last_summary_detected'])} />
          <DiagRow label="Última confirmación" value={fmtDiag(diagnostics['last_confirmation_detected'])} />
          <DiagRow label="Último booking_request creado" value={fmtDiag(diagnostics['last_booking_request_created'])} />
        </div>
        {conversationCount === 0 && (
          <p className="text-xs text-amber-600">
            No se recibieron eventos de Botmaker todavía. Verificá la URL del webhook y el header <code>auth-bm-token</code>.
          </p>
        )}
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Pedidos de reserva pendientes (booking_requests)</h3>
          <Button variant="outline" size="sm" onClick={() => setHideTestRequests(v => !v)}>
            {hideTestRequests ? 'Mostrar pedidos test' : 'Ocultar pedidos test'}
          </Button>
        </div>
        {(() => {
          const visible = hideTestRequests ? requests.filter(r => !r.is_test) : requests;
          if (visible.length === 0) {
            return <p className="text-sm text-muted-foreground py-6 text-center">Sin pedidos pendientes.</p>;
          }
          return (
            <div className="space-y-2">
              {visible.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs border-b border-border/50 last:border-0 py-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {r.customer_name ?? 'Sin nombre'} · {r.customer_phone}
                      {r.is_test && <Badge variant="outline" className="ml-2">test</Badge>}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {r.preferred_date ?? '?'} {r.preferred_time ?? ''} · {r.service_type ?? '—'} · {r.address ?? '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline">{r.status}</Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString('es-AR')}</span>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {r.status !== 'converted' && r.status !== 'rejected' && (
                        <button
                          onClick={() => approveRequest(r.id)}
                          disabled={busyRequestId === r.id}
                          className="text-[10px] text-green-600 hover:underline font-semibold disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                      )}
                      <button
                        onClick={() => updateRequest(r.id, 'request_more_info')}
                        disabled={busyRequestId === r.id}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Pedir más datos
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Motivo de rechazo:');
                          if (reason && reason.trim()) updateRequest(r.id, 'reject', reason);
                        }}
                        disabled={busyRequestId === r.id}
                        className="text-[10px] text-destructive hover:underline"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => updateRequest(r.id, 'toggle_test')}
                        disabled={busyRequestId === r.id}
                        className="text-[10px] text-muted-foreground hover:underline"
                      >
                        {r.is_test ? 'Marcar real' : 'Marcar test'}
                      </button>
                      <button
                        onClick={() => viewRawPayload(r.id)}
                        className="text-[10px] text-muted-foreground hover:underline inline-flex items-center gap-0.5"
                      >
                        <Eye className="w-2.5 h-2.5" /> Raw
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
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
            <Button variant="outline" size="sm" onClick={() => simulateWebhookEvent('unauthenticated')} disabled={simulating}>
              <FlaskConical className="w-3.5 h-3.5 mr-1" />
              {simulating ? 'Enviando…' : 'Simular evento sin token'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => simulateWebhookEvent('authenticated')} disabled={simulating}>
              <FlaskConical className="w-3.5 h-3.5 mr-1" />
              {simulating ? 'Enviando…' : 'Simular evento autenticado'}
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
        <pre className="bg-background border border-border rounded p-2 overflow-x-auto text-[10px]">{`const res = await fetch("${CREATE_BOOKING_URL}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "auth-bm-token": "<BOTMAKER_WEBHOOK_SECRET>"
  },
  body: JSON.stringify({
    conversation_id: context.conversation.id,
    channel: "whatsapp",
    customer_phone: context.contact.phone,
    customer_name: vars.customer_name,
    address: vars.address,
    neighborhood: vars.neighborhood,
    vehicle_type: vars.vehicle_type,
    service_type: vars.service_type,
    preferred_date: vars.preferred_date,
    preferred_time: vars.preferred_time,
    payment_method: vars.payment_method,
    notes: vars.notes,
    ai_booking_summary: vars.ai_booking_summary,
    raw_conversation: vars.raw_conversation
  })
});
const data = await res.json().catch(() => ({}));
if (res.ok && data && data.message) {
  result.text(data.message);   // un único mensaje
} else {
  result.text("No pudimos procesar tu reserva ahora. Te contactamos por WhatsApp en breve 🙌");
}
result.done();                 // siempre cerrar; nunca encadenar a fallback genérico`}</pre>
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
