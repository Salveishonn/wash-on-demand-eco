import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Loader2, MapPin, Clock, Car, Navigation, 
  CheckCircle, ChevronRight, MessageCircle,
  AlertCircle, CreditCard, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOperatorNotifications } from '@/hooks/useOperatorNotifications';
import RouteOptimizer from '@/components/ops/RouteOptimizer';
import JobWorkflowActions from '@/components/ops/JobWorkflowActions';
import JobPhotoUpload from '@/components/ops/JobPhotoUpload';

interface TodayBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address: string | null;
  barrio: string | null;
  service_name: string;
  car_type: string | null;
  vehicle_size: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  is_subscription_booking: boolean;
  notes: string | null;
  final_price_ars: number | null;
  total_price_ars: number | null;
  latitude: number | null;
  longitude: number | null;
}

export default function OpsToday() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<TodayBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { unreadCount } = useOperatorNotifications();

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchToday = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('bookings')
        .select('id, booking_date, booking_time, customer_name, customer_phone, customer_email, address, barrio, service_name, car_type, vehicle_size, status, payment_status, payment_method, is_subscription_booking, notes, final_price_ars, total_price_ars, latitude, longitude')
        .eq('booking_date', today)
        .eq('is_test', false)
        .in('status', ['pending', 'confirmed', 'completed'])
        .order('booking_time', { ascending: true });

      if (fetchErr) {
        console.warn('[OpsToday] Fetch error:', fetchErr);
        setError('No se pudieron cargar los lavados');
      }
      setBookings((data as TodayBooking[]) || []);
    } catch (err) {
      console.warn('[OpsToday] Unexpected error:', err);
      setError('Error de conexión');
      setBookings([]);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchToday(); }, []);

  const stats = useMemo(() => {
    const pending = bookings.filter(b => b.status === 'pending').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const unpaid = bookings.filter(b => b.payment_status === 'pending').length;
    return { total: bookings.length, pending, confirmed, completed, unpaid };
  }, [bookings]);

  const now = format(new Date(), 'HH:mm');
  const nextBooking = bookings.find(b => b.booking_time >= now && b.status !== 'completed');

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pendiente', className: 'bg-yellow-500/20 text-yellow-600 border-yellow-300' },
      confirmed: { label: 'Confirmado', className: 'bg-accent/20 text-accent border-accent/30' },
      completed: { label: 'Completado', className: 'bg-accent/20 text-accent border-accent/30' },
    };
    const s = map[status] || { label: status, className: '' };
    return <Badge variant="outline" className={cn("text-[10px] font-semibold", s.className)}>{s.label}</Badge>;
  };

  const getPaymentBadge = (ps: string) => {
    if (ps === 'paid') return <Badge variant="outline" className="text-[10px] bg-accent/20 text-accent border-accent/30">Pagado</Badge>;
    if (ps === 'pending') return <Badge variant="outline" className="text-[10px] bg-yellow-500/20 text-yellow-700 border-yellow-300">Sin pagar</Badge>;
    return null;
  };

  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const sendQuickWhatsApp = (phone: string, message: string) => {
    try {
      const cleanPhone = (phone || '').replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground capitalize">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} lavados programados
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={fetchToday} className="h-9 w-9">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
          {error}
          <Button size="sm" variant="ghost" className="ml-2 h-7 text-xs" onClick={fetchToday}>Reintentar</Button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Pendientes', value: stats.pending, color: 'text-yellow-600' },
          { label: 'Confirmados', value: stats.confirmed, color: 'text-accent' },
          { label: 'Sin pagar', value: stats.unpaid, color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl p-3 text-center border border-border">
            <p className={cn("text-2xl font-bold font-display", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {unreadCount > 0 && (
        <button 
          onClick={() => navigate('/ops/notifications')}
          className="w-full bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">{unreadCount} alerta{unreadCount > 1 ? 's' : ''} sin leer</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
        </button>
      )}

      {nextBooking && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Próximo</p>
          <p className="text-sm font-bold text-foreground">{nextBooking.booking_time?.slice(0, 5)} — {nextBooking.customer_name}</p>
          <p className="text-xs text-muted-foreground">{nextBooking.service_name} · {nextBooking.barrio || nextBooking.address || 'Sin dirección'}</p>
        </div>
      )}

      {/* Route Optimizer */}
      <RouteOptimizer bookings={bookings} />

      {bookings.length === 0 && !error ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-accent mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground font-medium">No hay lavados para hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const isExpanded = expandedId === b.id;
            return (
              <div 
                key={b.id} 
                className={cn(
                  "bg-card rounded-xl border border-border overflow-hidden transition-all",
                  b.status === 'completed' && "opacity-60"
                )}
              >
                <button 
                  className="w-full px-4 py-3 flex items-start gap-3 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                >
                  <div className="flex flex-col items-center min-w-[48px]">
                    <span className="text-lg font-bold font-display text-foreground">{(b.booking_time || '').slice(0, 5)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground truncate">{b.customer_name}</span>
                      {b.is_subscription_booking && (
                        <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30 shrink-0">Plan</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{b.service_name}</p>
                    {b.barrio && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{b.barrio}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {getStatusBadge(b.status)}
                    {getPaymentBadge(b.payment_status)}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {b.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{b.address}</span>
                        </div>
                      )}
                      {b.vehicle_size && (
                        <div className="flex items-center gap-2">
                          <Car className="w-3.5 h-3.5 shrink-0" />
                          <span>{b.vehicle_size}{b.car_type ? ` · ${b.car_type}` : ''}</span>
                        </div>
                      )}
                      {(b.final_price_ars || b.total_price_ars) && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 shrink-0" />
                          <span>${(b.final_price_ars || b.total_price_ars || 0).toLocaleString('es-AR')}</span>
                        </div>
                      )}
                      {b.notes && (
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span className="italic">{b.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Job Workflow */}
                    {b.status !== 'completed' && (
                      <JobWorkflowActions
                        bookingId={b.id}
                        currentStatus={b.status}
                        customerName={b.customer_name}
                        onStatusChange={fetchToday}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {b.address && (
                        <Button size="sm" variant="outline" className="h-10 text-xs" onClick={() => openMaps(b.address!)}>
                          <Navigation className="w-3.5 h-3.5 mr-1.5" />
                          Navegar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-10 text-xs" onClick={() => sendQuickWhatsApp(b.customer_phone, `Hola ${(b.customer_name || '').split(' ')[0]}, soy de Washero 🚗`)}>
                        <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                        WhatsApp
                      </Button>
                    </div>

                    {/* Before/After Photos */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <JobPhotoUpload bookingId={b.id} type="before" />
                      <JobPhotoUpload bookingId={b.id} type="after" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
