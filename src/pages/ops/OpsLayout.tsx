import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOperatorNotifications } from '@/hooks/useOperatorNotifications';
import { subscribeToPush, isPushSubscribed } from '@/lib/pushNotifications';
import { 
  CalendarDays, MessageCircle, Bell, Home, Settings, Loader2, Download, Share, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import OpsToday from './OpsToday';
import OpsCalendar from './OpsCalendar';
import OpsMessages from './OpsMessages';
import OpsNotifications from './OpsNotifications';
import OpsSettings from './OpsSettings';

type OpsTab = 'today' | 'calendar' | 'messages' | 'notifications' | 'settings';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

function isIOS() {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function OpsLayout() {
  const { user, isAdmin, isLoading } = useAuth();
  const { unreadCount } = useOperatorNotifications();
  const [activeTab, setActiveTab] = useState<OpsTab>('today');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    isPushSubscribed().then(setPushEnabled).catch(() => setPushEnabled(false));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Show onboarding if not installed and first visit
  useEffect(() => {
    if (!isStandalone()) {
      const dismissed = sessionStorage.getItem('ops-onboarding-dismissed');
      if (!dismissed) setShowOnboarding(true);
    }
  }, []);

  // Auto-enable push — wrapped safely
  useEffect(() => {
    if (user && isAdmin && !pushEnabled) {
      subscribeToPush(user.id).then(setPushEnabled).catch(() => {});
    }
  }, [user, isAdmin, pushEnabled]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-washero-charcoal">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: { pathname: '/ops' } }} replace />;
  }

  const handleInstall = async () => {
    try {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setShowInstallBanner(false);
          setShowOnboarding(false);
        }
        setDeferredPrompt(null);
      }
    } catch {}
  };

  const handleEnablePush = () => {
    subscribeToPush(user.id).then(setPushEnabled).catch(() => {});
  };

  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    sessionStorage.setItem('ops-onboarding-dismissed', '1');
  };

  const tabs: { key: OpsTab; label: string; icon: typeof Home; badge?: number }[] = [
    { key: 'today', label: 'Hoy', icon: Home },
    { key: 'calendar', label: 'Agenda', icon: CalendarDays },
    { key: 'messages', label: 'Mensajes', icon: MessageCircle },
    { key: 'notifications', label: 'Alertas', icon: Bell, badge: unreadCount },
    { key: 'settings', label: 'Ajustes', icon: Settings },
  ];

  const renderContent = () => {
    try {
      switch (activeTab) {
        case 'today': return <OpsToday onNavigate={setActiveTab} />;
        case 'calendar': return <OpsCalendar />;
        case 'messages': return <OpsMessages />;
        case 'notifications': return <OpsNotifications />;
        case 'settings': return <OpsSettings pushEnabled={pushEnabled} onEnablePush={handleEnablePush} />;
      }
    } catch (err) {
      console.error('[Ops] Render error:', err);
      return (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-destructive">Error al cargar. Intentá de nuevo.</p>
          <Button size="sm" className="mt-4" onClick={() => setActiveTab('today')}>Volver a Hoy</Button>
        </div>
      );
    }
  };

  // Onboarding / install screen
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-washero-charcoal flex flex-col items-center justify-center px-6 text-center">
        <img src="/icons/washero-driver-192.png" alt="Washero Driver" className="w-20 h-20 rounded-2xl mb-6" />
        <h1 className="font-display text-2xl font-black text-primary mb-2">Washero Driver</h1>
        <p className="text-muted-foreground text-sm max-w-xs mb-8 leading-relaxed">
          Usá esta app para gestionar reservas, mensajes y tareas del día desde el celular.
        </p>

        <div className="w-full max-w-xs space-y-3">
          <Button variant="hero" size="lg" className="w-full" onClick={handleDismissOnboarding}>
            Entrar a Ops
          </Button>

          {deferredPrompt && (
            <Button variant="outline" size="lg" className="w-full gap-2 border-primary/30 text-primary" onClick={handleInstall}>
              <Download className="w-4 h-4" />
              Instalar app
            </Button>
          )}

          {!deferredPrompt && isIOS() && !isStandalone() && (
            <div className="bg-card/10 border border-primary/20 rounded-xl p-4 text-left space-y-2 mt-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Instalar en iPhone</p>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Share className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>Tocá el botón <strong className="text-foreground">Compartir</strong> en Safari</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Plus className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>Seleccioná <strong className="text-foreground">Agregar a pantalla de inicio</strong></span>
              </div>
            </div>
          )}

          {!deferredPrompt && !isIOS() && !isStandalone() && (
            <p className="text-xs text-muted-foreground">
              Podés instalar esta app desde el menú del navegador → "Agregar a inicio"
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {showInstallBanner && (
        <div className="bg-washero-charcoal text-primary px-4 py-3 flex items-center justify-between gap-3 safe-top">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Download className="w-4 h-4" />
            <span>Instalá Washero Ops en tu celular</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowInstallBanner(false)} className="text-muted-foreground h-8 px-2">Luego</Button>
            <Button size="sm" onClick={handleInstall} className="h-8 px-3">Instalar</Button>
          </div>
        </div>
      )}

      <header className="bg-washero-charcoal text-primary px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <h1 className="font-display font-bold text-lg tracking-tight flex items-center gap-2">
          <img src="/icons/washero-driver-192.png" alt="" className="w-7 h-7 rounded-md" />
          Washero <span className="text-muted-foreground font-normal text-sm">Driver</span>
        </h1>
        <div className="flex items-center gap-2">
          {!pushEnabled && (
            <Button size="sm" variant="outline" className="h-8 text-xs border-primary/30 text-primary" onClick={handleEnablePush}>
              <Bell className="w-3.5 h-3.5 mr-1" />
              Activar alertas
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-bottom">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {tabs.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors relative",
                activeTab === key ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
