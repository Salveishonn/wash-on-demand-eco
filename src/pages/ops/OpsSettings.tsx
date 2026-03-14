import { useAuth } from '@/hooks/useAuth';
import { Bell, BellOff, LogOut, Shield, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface OpsSettingsProps {
  pushEnabled: boolean;
  onEnablePush: () => void;
}

export default function OpsSettings({ pushEnabled, onEnablePush }: OpsSettingsProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
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
        {pushEnabled ? (
          <div className="flex items-center gap-2 text-sm text-accent">
            <Bell className="w-4 h-4" />
            <span>Activadas ✓</span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Activá las notificaciones push para recibir alertas de nuevas reservas, mensajes y más.
            </p>
            <Button size="sm" onClick={onEnablePush} className="h-9">
              <Bell className="w-4 h-4 mr-1.5" />
              Activar notificaciones
            </Button>
          </div>
        )}
      </div>

      {/* Install PWA */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          Instalar App
        </h3>
        <p className="text-xs text-muted-foreground">
          Podés instalar Washero Ops como una app en tu celular. Abrí este sitio en Chrome/Safari y tocá "Agregar a pantalla de inicio".
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
