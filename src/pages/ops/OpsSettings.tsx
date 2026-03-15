import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Bell,
  BellOff,
  BellRing,
  LogOut,
  Shield,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  getPushState,
  subscribeToPush,
  sendTestPush,
  getPushDiagnostics,
  listenForPushMessages,
  markPushReceivedAt,
  showLocalTestNotification,
  type PushState,
  type PushDiagnostics,
} from '@/lib/pushNotifications';
import { toast } from 'sonner';
import PushDiagnosticsCard from '@/components/ops/PushDiagnosticsCard';

export default function OpsSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [pushEnabled, setPushEnabled] = useState(false);

  const [pushState, setPushState] = useState<PushState>('not_requested');
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingLocal, setIsTestingLocal] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const refreshPushData = useCallback(async () => {
    try {
      const [state, debug] = await Promise.all([getPushState(), getPushDiagnostics()]);
      setPushState(state);
      setDiagnostics(debug);
    } catch {
      setPushState('unsupported');
      setDiagnostics(null);
    }
  }, []);

  useEffect(() => {
    refreshPushData();
  }, [refreshPushData, pushEnabled]);

  useEffect(() => {
    const stopListening = listenForPushMessages((message) => {
      const receivedAt = message.receivedAt || new Date().toISOString();
      markPushReceivedAt(receivedAt);
      refreshPushData();
    });

    const onFocus = () => refreshPushData();
    window.addEventListener('focus', onFocus);
    return () => {
      stopListening();
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshPushData]);

  const handleActivate = useCallback(async () => {
    if (!user) return;
    setIsActivating(true);
    setTestError(null);

    const result = await subscribeToPush(user.id);

    if (result.success) {
      toast.success('Notificaciones activadas');
      setPushEnabled(true);
      await refreshPushData();
    } else if (result.error === 'denied') {
      setPushState('denied');
      toast.error('Permiso denegado. Habilitalo desde Ajustes del navegador.');
    } else if (result.error === 'not_installed') {
      setPushState('not_installed');
      toast.error('En iPhone/iPad tenés que abrir Washero Driver desde la app instalada en pantalla de inicio.');
    } else {
      toast.error(result.error || 'Error al activar notificaciones');
    }
    setIsActivating(false);
  }, [user, onEnablePush, refreshPushData]);

  const handleTestPush = useCallback(async () => {
    setIsTesting(true);
    setTestError(null);

    const result = await sendTestPush();

    if (result.success) {
      toast.success('Push enviada. Revisá la pantalla bloqueada.');
    } else {
      const details = result.failures?.[0]?.error || result.error || 'Error desconocido';
      setTestError(`Push failed: ${details}`);
      toast.error(`No se pudo enviar: ${details}`);
    }

    setIsTesting(false);
    await refreshPushData();
  }, [refreshPushData]);

  const handleLocalTest = useCallback(async () => {
    setIsTestingLocal(true);
    setTestError(null);

    const result = await showLocalTestNotification();

    if (result.success) {
      toast.success('Notificación local enviada al service worker.');
    } else {
      setTestError(`Local failed: ${result.error}`);
      toast.error(`Error local: ${result.error}`);
    }

    setIsTestingLocal(false);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const renderPushStatus = () => {
    switch (pushState) {
      case 'unsupported':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BellOff className="w-4 h-4" />
              <span>No compatible en este navegador</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Usá Safari/Chrome actualizados.
            </p>
          </div>
        );

      case 'not_installed':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="w-4 h-4" />
              <span>Instalación requerida en iPhone/iPad</span>
            </div>
            <p className="text-xs text-muted-foreground">
              En iOS la push solo funciona desde la app instalada en pantalla de inicio.
            </p>
            <Button size="sm" onClick={handleActivate} disabled={isActivating} className="h-9 gap-1.5">
              {isActivating ? 'Verificando...' : 'Reintentar desde la app instalada'}
            </Button>
          </div>
        );

      case 'denied':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="w-4 h-4" />
              <span>Permiso denegado</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Habilitalo en Ajustes del navegador → Notificaciones → Permitir.
            </p>
          </div>
        );

      case 'subscribed':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-accent">
              <CheckCircle2 className="w-4 h-4" />
              <span>Notificaciones activadas</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recibirás alertas incluso con la app cerrada.
            </p>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4" />
              <span>{pushState === 'unsubscribed' ? 'Push no suscripto' : 'Permiso no solicitado'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Activá push para recibir reservas, mensajes y cambios de agenda.
            </p>
            <Button size="sm" onClick={handleActivate} disabled={isActivating} className="h-9 gap-1.5">
              {isActivating ? 'Activando...' : 'Activar notificaciones'}
              {!isActivating && <BellRing className="w-4 h-4" />}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="px-4 py-4 space-y-6">
      <h2 className="text-lg font-display font-bold text-foreground">Ajustes</h2>

      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-washero-charcoal flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notificaciones Push
        </h3>
        {renderPushStatus()}
        <PushDiagnosticsCard
          diagnostics={diagnostics}
          isTesting={isTesting}
          isTestingLocal={isTestingLocal}
          canSendTest={pushState === 'subscribed'}
          testError={testError}
          onSendTest={handleTestPush}
          onLocalTest={handleLocalTest}
        />
      </div>

      {(pushState === 'not_installed' || (diagnostics?.isIOS && !diagnostics?.isStandalone)) && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Ayuda para iPhone/iPad</h3>
          <p className="text-xs text-muted-foreground">
            Para recibir notificaciones: 1) Instalá Washero Driver en pantalla de inicio, 2) Abrí la app instalada, 3) Activá notificaciones desde Ajustes.
          </p>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          Instalar App
        </h3>
        <p className="text-xs text-muted-foreground">
          En Safari/Chrome: menú compartir → Agregar a pantalla de inicio.
        </p>
      </div>

      <Button variant="outline" className="w-full h-11" onClick={() => navigate('/admin')}>
        Ir al Panel Admin completo
      </Button>

      <Button variant="ghost" className="w-full h-11 text-destructive hover:text-destructive" onClick={handleSignOut}>
        <LogOut className="w-4 h-4 mr-2" />
        Cerrar sesión
      </Button>
    </div>
  );
}
