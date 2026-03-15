import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PushDiagnostics } from '@/lib/pushNotifications';
import { CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';

interface PushDiagnosticsCardProps {
  diagnostics: PushDiagnostics | null;
  isTesting: boolean;
  canSendTest: boolean;
  testError: string | null;
  onSendTest: () => void;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Badge variant={ok ? 'default' : 'secondary'} className="text-[11px] font-medium">
      {text}
    </Badge>
  );
}

export default function PushDiagnosticsCard({
  diagnostics,
  isTesting,
  canSendTest,
  testError,
  onSendTest,
}: PushDiagnosticsCardProps) {
  const permission = diagnostics?.permission ?? 'unsupported';

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <h4 className="text-sm font-semibold text-foreground">Diagnóstico de notificaciones</h4>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Permiso de notificaciones</span>
          <StatusBadge ok={permission === 'granted'} text={permission} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Service worker</span>
          <StatusBadge
            ok={Boolean(diagnostics?.serviceWorkerRegistered && diagnostics?.serviceWorkerReady)}
            text={diagnostics?.serviceWorkerRegistered ? 'registered' : 'not registered'}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Suscripción push</span>
          <StatusBadge ok={Boolean(diagnostics?.subscriptionActive)} text={diagnostics?.subscriptionActive ? 'subscribed' : 'not subscribed'} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Última prueba enviada</span>
          <span className="text-foreground font-medium">{formatDate(diagnostics?.lastTestPushSentAt ?? null)}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Última push recibida</span>
          <span className="text-foreground font-medium">{formatDate(diagnostics?.lastTestPushReceivedAt ?? null)}</span>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={onSendTest}
        disabled={isTesting || !canSendTest}
        className="h-9 gap-1.5"
      >
        {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {isTesting ? 'Enviando...' : 'Enviar notificación de prueba'}
      </Button>

      {!canSendTest && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <XCircle className="w-4 h-4 mt-0.5" />
          <p>Primero activá las notificaciones para poder enviar una prueba real.</p>
        </div>
      )}

      {testError && (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <XCircle className="w-4 h-4 mt-0.5" />
          <p>{testError}</p>
        </div>
      )}

      {diagnostics?.lastTestPushReceivedAt && (
        <div className="flex items-start gap-2 text-xs text-accent">
          <CheckCircle2 className="w-4 h-4 mt-0.5" />
          <p>Push recibida en el dispositivo.</p>
        </div>
      )}
    </div>
  );
}
