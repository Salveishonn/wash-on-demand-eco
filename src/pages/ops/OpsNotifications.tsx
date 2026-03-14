import { useOperatorNotifications, OperatorNotification } from '@/hooks/useOperatorNotifications';
import { Bell, CheckCheck, Loader2, Calendar, MessageCircle, CreditCard, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const EVENT_ICONS: Record<string, typeof Bell> = {
  new_booking: Calendar,
  booking_cancelled: XCircle,
  booking_rescheduled: Clock,
  new_whatsapp: MessageCircle,
  payment_received: CreditCard,
};

const EVENT_COLORS: Record<string, string> = {
  new_booking: 'bg-primary/15 text-primary',
  booking_cancelled: 'bg-destructive/15 text-destructive',
  booking_rescheduled: 'bg-yellow-500/15 text-yellow-600',
  new_whatsapp: 'bg-accent/15 text-accent',
  payment_received: 'bg-accent/15 text-accent',
};

export default function OpsNotifications() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useOperatorNotifications();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground">Notificaciones</h2>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={markAllAsRead}>
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Marcar todas
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Sin notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon = EVENT_ICONS[n.event_type] || Bell;
            const colorClass = EVENT_COLORS[n.event_type] || 'bg-muted text-muted-foreground';
            return (
              <button
                key={n.id}
                onClick={() => !n.read && markAsRead(n.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-colors",
                  n.read ? "bg-card border border-border opacity-70" : "bg-card border-2 border-primary/20"
                )}
              >
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm", n.read ? "text-foreground" : "text-foreground font-semibold")}>
                      {n.title}
                    </p>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: es })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
