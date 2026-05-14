import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageSquare, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

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
  status: string;
  created_at: string;
}

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/botmaker-webhook`;

export function BotmakerTab() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<BotmakerEvent[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [signatureCheck, setSignatureCheck] = useState<string>('-');

  const load = async () => {
    setLoading(true);
    const [evts, reqs] = await Promise.all([
      supabase.from('botmaker_events').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('booking_requests').select('id,customer_name,customer_phone,status,created_at').order('created_at', { ascending: false }).limit(10),
    ]);
    if (evts.error) toast.error('Error cargando eventos');
    else setEvents((evts.data ?? []) as BotmakerEvent[]);
    if (!reqs.error) setRequests((reqs.data ?? []) as BookingRequest[]);
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
          Configurar este URL en Botmaker como callback. Header de seguridad esperado: <code>auth-bm-token</code> con el valor exacto de <code>BOTMAKER_WEBHOOK_SECRET</code>.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Eventos recientes</h3>
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

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Pedidos de reserva pendientes</h3>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin pedidos pendientes.</p>
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between text-xs border-b border-border/50 last:border-0 py-2">
                <div>
                  <span className="font-semibold">{r.customer_name || 'Sin nombre'}</span>
                  <span className="text-muted-foreground ml-2">{r.customer_phone}</span>
                </div>
                <Badge variant="outline">{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <p>
          <strong className="text-foreground">Nota:</strong> esta es la fase de fundación (Milestone A).
          El procesamiento de eventos, sincronización de clientes y envío saliente vía Botmaker
          se habilitan en milestones siguientes.
        </p>
        <p>
          Provider activo: definido por la variable de entorno <code>COMMUNICATION_PROVIDER</code> en el backend.
        </p>
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
