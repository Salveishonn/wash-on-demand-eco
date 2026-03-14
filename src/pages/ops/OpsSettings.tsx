import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  Bell, BellOff, BellRing, LogOut, Shield, Smartphone, 
  Send, CheckCircle2, XCircle, AlertTriangle, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  getPushState, subscribeToPush, sendTestPush, 
  type PushState 
} from '@/lib/pushNotifications';
import { toast } from 'sonner';

interface OpsSettingsProps {
  pushEnabled: boolean;
  onEnablePush: () => void;
}

export default function OpsSettings({ pushEnabled, onEnablePush }: OpsSettingsProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [pushState, setPushState] = useState<PushState>('not_requested');
  const [isActivating, setIsActivating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    getPushState().then(setPushState).catch(() => setPushState('unsupported'));
  }, [pushEnabled]);

  const handleActivate = useCallback(async () => {
    if (!user) return;
    setIsActivating(true);
    setTestResult(null);
    
    const result = await subscribeToPush(user.id);
    
    if (result.success) {
      setPushState('subscribed');
      onEnablePush();
      toast.success('Notificaciones push activadas');
    } else if (result.error === 'denied') {
      setPushState('denied');
      toast.error('Permiso denegado. Habilitalo desde los ajustes del navegador.');
    } else {
      toast.error(result.error || 'Error al activar push');
    }
    
    setIsActivating(false);
  }, [user, onEnablePush]);

  const handleTestPush = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);

    const result = await sendTestPush();
    
    if (result.success) {
      setTestResult('success');
      toast.success('Notificación de prueba enviada. Revisá tu pantalla.');
    } else {
      setTestResult('error');
      toast.error(result.error || 'Error al enviar prueba');
    }
    
    setIsTesting(false);
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
              Las notificaciones push requieren un navegador compatible (Chrome, Edge, Firefox) o instalar la app como PWA en iOS 16.4+.
            </p>
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
              El permiso fue denegado. Para habilitarlo, andá a la configuración del navegador → Sitios → Notificaciones y permití este sitio.
            </p>
          </div>
        );

      case 'subscribed':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-accent">
              <CheckCircle2 className="w-4 h-4" />
              <span>Push activado ✓</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Vas a recibir notificaciones de nuevas reservas, mensajes y más, incluso con la app cerrada.
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleTestPush} 
              disabled={isTesting}
              className="h-9 gap-1.5"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : testResult === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-accent" />
              ) : testResult === 'error' ? (
                <XCircle className="w-4 h-4 text-destructive" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isTesting ? 'Enviando...' : 'Enviar notificación de prueba'}
            </Button>
          </div>
        );

      case 'not_requested':
      case 'unsubscribed':
      default:
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4" />
              <span>{pushState === 'unsubscribed' ? 'Push no suscripto' : 'Permiso no solicitado'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Activá las notificaciones push para recibir alertas de nuevas reservas, mensajes y más, incluso con la app cerrada.
            </p>
            <Button 
              size="sm" 
              onClick={handleActivate} 
              disabled={isActivating}
              className="h-9 gap-1.5"
            >
              {isActivating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BellRing className="w-4 h-4" />
              )}
              {isActivating ? 'Activando...' : 'Activar notificaciones'}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="px-4 py-4 space-y-6">
      <h2 className="text-lg font-display font-bold text-foreground">Ajustes</h2>

      {/* Account */}
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

      {/* Push notifications */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notificaciones Push
        </h3>
        {renderPushStatus()}
      </div>

      {/* Install PWA */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          Instalar App
        </h3>
        <p className="text-xs text-muted-foreground">
          Podés instalar Washero Driver como una app en tu celular. Abrí este sitio en Chrome/Safari y tocá "Agregar a pantalla de inicio".
        </p>
      </div>

      {/* Admin panel link */}
      <Button variant="outline" className="w-full h-11" onClick={() => navigate('/admin')}>
        Ir al Panel Admin completo
      </Button>

      {/* Sign out */}
      <Button variant="ghost" className="w-full h-11 text-destructive hover:text-destructive" onClick={handleSignOut}>
        <LogOut className="w-4 h-4 mr-2" />
        Cerrar sesión
      </Button>
    </div>
  );
}
