import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  X,
  Clock,
  CreditCard,
  Users,
  Loader2,
  CheckCircle,
  RefreshCw,
  Sparkles,
  MapPin,
  Phone,
  Car,
  Eye,
  XCircle,
  DollarSign,
  Send,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PhoneAction, AddressAction } from '@/components/admin/ContactActions';
import { sendCustomerNotification } from '@/lib/notifications/sendCustomerNotification';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  isToday,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';

interface AddonItem {
  addon_id: string;
  name: string;
  price_cents: number;
}

interface CalendarBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address: string | null;
  service_name: string;
  car_type: string | null;
  service_price_cents: number | null;
  car_type_extra_cents: number | null;
  addons: AddonItem[] | null;
  addons_total_cents: number | null;
  total_cents: number | null;
  booking_status: string;
  payment_status: string;
  payment_method: string | null;
  subscription_id: string | null;
  is_subscription_booking: boolean;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  booking_source: string | null;
}

type ViewMode = 'day' | 'week' | 'month';

const formatPrice = (cents: number | null | undefined) => {
  if (cents == null) return '$0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const getPaymentBadge = (booking: CalendarBooking) => {
  if (booking.is_subscription_booking) {
    return <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px]">SUB</Badge>;
  }
  const statusMap: Record<string, { className: string; label: string }> = {
    approved: { className: 'bg-green-100 text-green-800', label: 'Pagado' },
    pending: { className: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
    rejected: { className: 'bg-red-100 text-red-800', label: 'Rechazado' },
  };
  const config = statusMap[booking.payment_status] || { className: 'bg-gray-100 text-gray-800', label: booking.payment_status };
  return <Badge variant="secondary" className={`${config.className} text-[10px]`}>{config.label}</Badge>;
};

const getServiceColor = (serviceName: string): string => {
  const name = serviceName.toLowerCase();
  if (name.includes('premium') || name.includes('completo')) return 'border-l-purple-500 bg-purple-50/50';
  if (name.includes('interior')) return 'border-l-blue-500 bg-blue-50/50';
  if (name.includes('exterior')) return 'border-l-green-500 bg-green-50/50';
  return 'border-l-gray-500 bg-gray-50/50';
};

const getAddonsCount = (booking: CalendarBooking): number => {
  if (!booking.addons || !Array.isArray(booking.addons)) return 0;
  return booking.addons.length;
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { className: string; label: string }> = {
    pending: { className: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
    confirmed: { className: 'bg-blue-100 text-blue-800', label: 'Confirmada' },
    completed: { className: 'bg-green-100 text-green-800', label: 'Completada' },
    cancelled: { className: 'bg-red-100 text-red-800', label: 'Cancelada' },
  };
  const c = config[status] || { className: 'bg-gray-100 text-gray-800', label: status };
  return <Badge variant="secondary" className={`${c.className} text-[10px]`}>{c.label}</Badge>;
};

/* ── Booking Card for day list ── */
function BookingCard({
  booking,
  onAction,
  onDetail,
  updatingId,
  onSendOnMyWay,
  sendingOnMyWayId,
  notifiedBookings,
}: {
  booking: CalendarBooking;
  onAction: (id: string, action: 'confirm' | 'complete' | 'cancel' | 'paid') => void;
  onDetail: (b: CalendarBooking) => void;
  updatingId: string | null;
  onSendOnMyWay: (b: CalendarBooking) => void;
  sendingOnMyWayId: string | null;
  notifiedBookings: Set<string>;
}) {
  const isUpdating = updatingId === booking.id;
  const addonsCount = getAddonsCount(booking);

  return (
    <div className={`rounded-xl border p-3 sm:p-4 space-y-2.5 ${getServiceColor(booking.service_name)} border-l-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base">{booking.booking_time}</span>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="font-medium text-sm truncate">{booking.service_name}</span>
            {addonsCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5">
                <Sparkles className="w-3 h-3 mr-0.5" />+{addonsCount}
              </Badge>
            )}
          </div>
          <p className="font-semibold text-sm mt-0.5">{booking.customer_name}</p>
        </div>
        <span className="font-bold text-base whitespace-nowrap">{formatPrice(booking.total_cents)}</span>
      </div>

      {/* Status row */}
      <div className="flex gap-1.5 flex-wrap">
        {getStatusBadge(booking.booking_status)}
        {getPaymentBadge(booking)}
        {booking.payment_method && (
          <Badge variant="outline" className="text-[10px]">{booking.payment_method}</Badge>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <a href={`tel:${booking.customer_phone}`} className="text-primary hover:underline text-xs">
            {booking.customer_phone}
          </a>
        </div>
        {booking.address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-xs text-muted-foreground line-clamp-2">{booking.address}</span>
          </div>
        )}
        {booking.car_type && (
          <div className="flex items-center gap-2">
            <Car className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{booking.car_type}</span>
          </div>
        )}
        {booking.notes && (
          <p className="text-xs text-muted-foreground italic truncate">📝 {booking.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
        {booking.booking_status === 'pending' && (
          <Button size="sm" onClick={() => onAction(booking.id, 'confirm')} disabled={isUpdating} className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
            Confirmar
          </Button>
        )}
        {booking.booking_status === 'confirmed' && (
          <Button size="sm" onClick={() => onAction(booking.id, 'complete')} disabled={isUpdating} className="h-8 text-xs">
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
            Completar
          </Button>
        )}
        {booking.payment_status === 'pending' && !booking.is_subscription_booking && (
          <Button size="sm" variant="outline" onClick={() => onAction(booking.id, 'paid')} disabled={isUpdating} className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50">
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <DollarSign className="w-3 h-3 mr-1" />}
            Cobrado
          </Button>
        )}
        {booking.booking_status === 'confirmed' && (
          <Button size="sm" variant="outline" onClick={() => onSendOnMyWay(booking)} disabled={sendingOnMyWayId === booking.id} className="h-8 text-xs text-amber-600 border-amber-300 hover:bg-amber-50">
            {sendingOnMyWayId === booking.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : notifiedBookings.has(booking.id) ? <CheckCircle className="w-3 h-3 mr-1 text-green-600" /> : <Send className="w-3 h-3 mr-1" />}
            {notifiedBookings.has(booking.id) ? '✓' : 'Camino'}
          </Button>
        )}
        {(booking.booking_status === 'pending' || booking.booking_status === 'confirmed') && (
          <Button size="sm" variant="ghost" onClick={() => onAction(booking.id, 'cancel')} disabled={isUpdating} className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
            <XCircle className="w-3 h-3 mr-1" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDetail(booking)} className="h-8 text-xs ml-auto">
          <Eye className="w-3 h-3 mr-1" /> Detalle
        </Button>
      </div>
    </div>
  );
}

export function CalendarTab() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'day' : 'week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [subscriptionOnly, setSubscriptionOnly] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [sendingOnMyWayId, setSendingOnMyWayId] = useState<string | null>(null);
  const [notifiedBookings, setNotifiedBookings] = useState<Set<string>>(new Set());
  
  // For mobile: selected day in week/month mode
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [showSearchMobile, setShowSearchMobile] = useState(false);

  const dateRange = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return { from: currentDate, to: currentDate };
      case 'week':
        return { from: startOfWeek(currentDate, { locale: es }), to: endOfWeek(currentDate, { locale: es }) };
      case 'month':
        return { from: startOfMonth(currentDate), to: endOfMonth(currentDate) };
      default:
        return { from: currentDate, to: currentDate };
    }
  }, [viewMode, currentDate]);

  const fetchCalendarBookings = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No session token');

      const response = await supabase.functions.invoke('admin-get-calendar-bookings', {
        body: {
          from: format(dateRange.from, 'yyyy-MM-dd'),
          to: format(dateRange.to, 'yyyy-MM-dd'),
          subscription_only: subscriptionOnly,
          search: searchTerm || undefined,
        },
      });

      if (response.error) throw new Error(response.error.message);

      setBookings(response.data?.bookings || []);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error fetching calendar bookings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las reservas',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateRange.from, dateRange.to, subscriptionOnly, searchTerm, toast]);

  useEffect(() => { fetchCalendarBookings(); }, [fetchCalendarBookings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== undefined) fetchCalendarBookings(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Realtime optional
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel('admin-calendar-bookings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchCalendarBookings(false))
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            if (channel) supabase.removeChannel(channel);
          }
        });
    } catch (e) { /* polling fallback */ }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [fetchCalendarBookings]);

  useEffect(() => {
    const interval = setInterval(() => fetchCalendarBookings(false), 30000);
    return () => clearInterval(interval);
  }, [fetchCalendarBookings]);

  const navigatePrev = () => {
    switch (viewMode) {
      case 'day': setCurrentDate(addDays(currentDate, -1)); setSelectedDay(addDays(currentDate, -1)); break;
      case 'week': setCurrentDate(subWeeks(currentDate, 1)); break;
      case 'month': setCurrentDate(subMonths(currentDate, 1)); break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case 'day': setCurrentDate(addDays(currentDate, 1)); setSelectedDay(addDays(currentDate, 1)); break;
      case 'week': setCurrentDate(addWeeks(currentDate, 1)); break;
      case 'month': setCurrentDate(addMonths(currentDate, 1)); break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  };

  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, CalendarBooking[]> = {};
    bookings.forEach((booking) => {
      const date = booking.booking_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(booking);
    });
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => (a.booking_time || '').localeCompare(b.booking_time || ''));
    });
    return grouped;
  }, [bookings]);

  const viewDates = useMemo(() => {
    const dates: Date[] = [];
    let current = dateRange.from;
    while (current <= dateRange.to) {
      dates.push(current);
      current = addDays(current, 1);
    }
    return dates;
  }, [dateRange]);

  // Bookings for the selected day (used in mobile day strip)
  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayBookings = useMemo(() => {
    return (bookingsByDate[selectedDayStr] || []).sort((a, b) => (a.booking_time || '').localeCompare(b.booking_time || ''));
  }, [selectedDayStr, bookingsByDate]);

  const selectedDayStats = useMemo(() => {
    const totalRevenue = selectedDayBookings.reduce((sum, b) => sum + (b.total_cents || 0), 0);
    return { count: selectedDayBookings.length, revenue: totalRevenue };
  }, [selectedDayBookings]);

  const handleDayAction = async (bookingId: string, action: 'confirm' | 'complete' | 'cancel' | 'paid') => {
    setUpdatingBookingId(bookingId);
    try {
      let updateData: Record<string, string> = {};
      let msg = '';
      switch (action) {
        case 'confirm': updateData = { status: 'confirmed' }; msg = 'Confirmada'; break;
        case 'complete': updateData = { status: 'completed' }; msg = 'Completada'; break;
        case 'cancel': updateData = { status: 'cancelled' }; msg = 'Cancelada'; break;
        case 'paid': updateData = { payment_status: 'approved' }; msg = 'Pago marcado'; break;
      }
      const { error } = await supabase.from('bookings').update(updateData).eq('id', bookingId);
      if (error) throw error;
      toast({ title: msg });
      fetchCalendarBookings(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleSendOnMyWay = async (booking: CalendarBooking) => {
    if (!window.confirm(`¿Enviar "Estamos en camino" a ${booking.customer_phone}?`)) return;
    setSendingOnMyWayId(booking.id);
    try {
      const result = await sendCustomerNotification(booking.id, 'ON_MY_WAY');
      if (result.ok) {
        toast({ title: 'Notificado ✅' });
        setNotifiedBookings(prev => new Set(prev).add(booking.id));
        setTimeout(() => {
          setNotifiedBookings(prev => { const n = new Set(prev); n.delete(booking.id); return n; });
        }, 600000);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Error' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSendingOnMyWayId(null);
    }
  };

  const handleMarkAsPaid = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('bookings').update({ payment_status: 'approved' }).eq('id', bookingId);
      if (error) throw error;
      toast({ title: 'Pago marcado' });
      fetchCalendarBookings();
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsUpdating(false); }
  };

  const handleComplete = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
      if (error) throw error;
      toast({ title: 'Completada' });
      fetchCalendarBookings();
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsUpdating(false); }
  };

  const handleCancel = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      // Check if this is a subscription booking that needs credit restoration
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('is_subscription_booking, subscription_id, booking_date, booking_time')
        .eq('id', bookingId)
        .single();

      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;

      // Restore subscription credit if cancelled before service time
      if (bookingData?.is_subscription_booking && bookingData?.subscription_id) {
        const now = new Date();
        const serviceTime = new Date(`${bookingData.booking_date}T${bookingData.booking_time}:00`);
        if (now < serviceTime) {
          const { error: creditError } = await supabase.rpc('restore_subscription_credit' as any, {
            p_subscription_id: bookingData.subscription_id,
          });
          // Fallback: direct update if RPC doesn't exist
          if (creditError) {
            console.warn('RPC restore_subscription_credit not found, using direct update');
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('washes_remaining, washes_used_in_cycle')
              .eq('id', bookingData.subscription_id)
              .single();
            if (sub) {
              await supabase
                .from('subscriptions')
                .update({
                  washes_remaining: (sub.washes_remaining || 0) + 1,
                  washes_used_in_cycle: Math.max(0, (sub.washes_used_in_cycle || 0) - 1),
                })
                .eq('id', bookingData.subscription_id);
            }
          }
          console.log('[CalendarTab] Restored subscription credit for cancelled booking');
        }
      }

      toast({ title: 'Cancelada' });
      fetchCalendarBookings();
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsUpdating(false); }
  };

  const openBookingDetail = (booking: CalendarBooking) => {
    setSelectedBooking(booking);
    setIsDetailOpen(true);
  };

  const getDateTitle = () => {
    switch (viewMode) {
      case 'day': return format(currentDate, "EEE d MMM", { locale: es });
      case 'week': return `${format(dateRange.from, "d MMM", { locale: es })} – ${format(dateRange.to, "d MMM", { locale: es })}`;
      case 'month': return format(currentDate, "MMMM yyyy", { locale: es });
    }
  };

  // Mobile date strip for week mode
  const weekDates = useMemo(() => {
    if (viewMode !== 'week') return [];
    const dates: Date[] = [];
    let d = startOfWeek(currentDate, { locale: es });
    for (let i = 0; i < 7; i++) {
      dates.push(d);
      d = addDays(d, 1);
    }
    return dates;
  }, [viewMode, currentDate]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Controls */}
      <div className="space-y-3 mb-4">
        {/* Row 1: Nav + view mode */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={navigatePrev} className="h-10 w-10">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday} className="h-10 text-xs px-3">
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext} className="h-10 w-10">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex bg-muted rounded-lg p-0.5">
              {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    if (mode === 'day') setSelectedDay(currentDate);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === mode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'day' ? 'Día' : mode === 'week' ? 'Sem' : 'Mes'}
                </button>
              ))}
            </div>

            {/* Search toggle on mobile */}
            <Button variant="outline" size="icon" onClick={() => setShowSearchMobile(!showSearchMobile)} className="h-10 w-10 sm:hidden">
              <Search className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" onClick={() => fetchCalendarBookings(false)} disabled={isRefreshing} className="h-10 w-10">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Row 2: Title + search + filters */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-semibold capitalize truncate">{getDateTitle()}</h2>
          
          <div className="flex items-center gap-2">
            {/* Desktop search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-40 h-9"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <Button
              variant={subscriptionOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSubscriptionOnly(!subscriptionOnly)}
              className="h-9 text-xs"
            >
              <Users className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Suscripciones</span>
              <span className="sm:hidden">Sub</span>
            </Button>
          </div>
        </div>

        {/* Mobile search bar */}
        {showSearchMobile && (
          <div className="relative sm:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {bookings.length} reserva{bookings.length !== 1 ? 's' : ''}
            {viewMode !== 'day' && selectedDayBookings.length > 0 && (
              <> · <span className="font-medium text-foreground">{selectedDayBookings.length} hoy</span></>
            )}
          </span>
          <span>Act: {format(lastUpdated, 'HH:mm', { locale: es })}</span>
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ═══ DAY VIEW ═══ */}
          {viewMode === 'day' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span className="font-semibold capitalize">
                  {format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
                </span>
                {isToday(currentDate) && <Badge className="text-[10px] h-5">Hoy</Badge>}
                <span className="ml-auto text-sm font-medium">{formatPrice(selectedDayStats.revenue)}</span>
              </div>
              {selectedDayBookings.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Sin reservas para este día</p>
                </div>
              ) : (
                selectedDayBookings.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onAction={handleDayAction}
                    onDetail={openBookingDetail}
                    updatingId={updatingBookingId}
                    onSendOnMyWay={handleSendOnMyWay}
                    sendingOnMyWayId={sendingOnMyWayId}
                    notifiedBookings={notifiedBookings}
                  />
                ))
              )}
            </div>
          )}

          {/* ═══ WEEK VIEW ═══ */}
          {viewMode === 'week' && (
            <div className="space-y-3">
              {/* Mobile: horizontal date strip */}
              {isMobile ? (
                <>
                  <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
                    {weekDates.map((d) => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      const count = (bookingsByDate[dateStr] || []).length;
                      const isSelected = isSameDay(d, selectedDay);
                      const isTodayDate = isToday(d);
                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDay(d)}
                          className={`flex flex-col items-center min-w-[52px] px-2 py-2 rounded-xl transition-all ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : isTodayDate
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <span className="text-[10px] font-medium uppercase">{format(d, 'EEE', { locale: es })}</span>
                          <span className="text-lg font-bold">{format(d, 'd')}</span>
                          {count > 0 && (
                            <span className={`text-[10px] font-semibold ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Day detail list */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm font-semibold capitalize">{format(selectedDay, "EEEE d", { locale: es })}</span>
                    {isToday(selectedDay) && <Badge className="text-[10px] h-5">Hoy</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {selectedDayBookings.length} reserva{selectedDayBookings.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {selectedDayBookings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-sm">Sin reservas</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayBookings.map((b) => (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          onAction={handleDayAction}
                          onDetail={openBookingDetail}
                          updatingId={updatingBookingId}
                          onSendOnMyWay={handleSendOnMyWay}
                          sendingOnMyWayId={sendingOnMyWayId}
                          notifiedBookings={notifiedBookings}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Desktop week: 7-column grid */
                <div className="bg-background rounded-xl shadow-sm overflow-hidden border border-border/50">
                  <div className="grid grid-cols-7 gap-px bg-border">
                    {viewDates.map((date) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const dayBookings = bookingsByDate[dateStr] || [];
                      const isCurrentDay = isToday(date);
                      const isSelected = isSameDay(date, selectedDay);

                      return (
                        <div
                          key={dateStr}
                          onClick={() => setSelectedDay(date)}
                          className={`bg-background min-h-[350px] cursor-pointer hover:bg-muted/20 transition-colors ${
                            isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''
                          } ${isSelected ? 'bg-primary/5' : ''}`}
                        >
                          <div className={`p-2 border-b ${isCurrentDay ? 'bg-primary/5' : 'bg-muted/30'}`}>
                            <div className="text-xs font-medium capitalize">{format(date, 'EEE', { locale: es })}</div>
                            <div className={`text-xl font-bold ${isCurrentDay ? 'text-primary' : ''}`}>{format(date, 'd')}</div>
                          </div>
                          <div className="p-1.5 space-y-1">
                            {dayBookings.slice(0, 4).map((booking) => (
                              <button
                                key={booking.id}
                                onClick={(e) => { e.stopPropagation(); openBookingDetail(booking); }}
                                className={`w-full text-left p-1.5 rounded text-xs border-l-2 truncate ${getServiceColor(booking.service_name)}`}
                              >
                                {booking.booking_time} {booking.customer_name.split(' ')[0]}
                              </button>
                            ))}
                            {dayBookings.length > 4 && (
                              <div className="text-[10px] text-muted-foreground px-1">+{dayBookings.length - 4} más</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Selected day detail below grid */}
                  {selectedDayBookings.length > 0 && (
                    <div className="border-t p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <List className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm capitalize">{format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{selectedDayBookings.length} reservas · {formatPrice(selectedDayStats.revenue)}</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedDayBookings.map((b) => (
                          <BookingCard
                            key={b.id}
                            booking={b}
                            onAction={handleDayAction}
                            onDetail={openBookingDetail}
                            updatingId={updatingBookingId}
                            onSendOnMyWay={handleSendOnMyWay}
                            sendingOnMyWayId={sendingOnMyWayId}
                            notifiedBookings={notifiedBookings}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ MONTH VIEW ═══ */}
          {viewMode === 'month' && (
            <div className="space-y-3">
              {isMobile ? (
                /* Mobile month: compact calendar + day list below */
                <>
                  <div className="bg-background rounded-xl shadow-sm border border-border/50 overflow-hidden">
                    {/* Mini header */}
                    <div className="grid grid-cols-7 gap-px bg-border">
                      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                        <div key={d} className="bg-muted/50 p-1.5 text-center text-[10px] font-medium text-muted-foreground">{d}</div>
                      ))}
                    </div>
                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-px bg-border">
                      {viewDates.map((date) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const count = (bookingsByDate[dateStr] || []).length;
                        const isSelected = isSameDay(date, selectedDay);
                        const isTodayDate = isToday(date);
                        return (
                          <button
                            key={dateStr}
                            onClick={() => setSelectedDay(date)}
                            className={`bg-background min-h-[44px] p-1 text-center transition-colors relative ${
                              isSelected ? 'bg-primary/10' : 'hover:bg-muted/30'
                            } ${isTodayDate ? 'ring-1 ring-primary ring-inset' : ''}`}
                          >
                            <span className={`text-sm ${isTodayDate ? 'text-primary font-bold' : isSelected ? 'font-semibold' : ''}`}>
                              {format(date, 'd')}
                            </span>
                            {count > 0 && (
                              <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-0.5 ${isSelected ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected day jobs */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm font-semibold capitalize">{format(selectedDay, "EEE d MMM", { locale: es })}</span>
                    {isToday(selectedDay) && <Badge className="text-[10px] h-5">Hoy</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {selectedDayBookings.length} · {formatPrice(selectedDayStats.revenue)}
                    </span>
                  </div>

                  {selectedDayBookings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Sin reservas</div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayBookings.map((b) => (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          onAction={handleDayAction}
                          onDetail={openBookingDetail}
                          updatingId={updatingBookingId}
                          onSendOnMyWay={handleSendOnMyWay}
                          sendingOnMyWayId={sendingOnMyWayId}
                          notifiedBookings={notifiedBookings}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Desktop month grid */
                <div className="bg-background rounded-xl shadow-sm overflow-hidden border border-border/50">
                  <div className="grid grid-cols-7 gap-px bg-border">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                      <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
                    ))}
                    {viewDates.map((date) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const dayBookings = bookingsByDate[dateStr] || [];
                      const isCurrentDay = isToday(date);
                      const isSelected = isSameDay(date, selectedDay);
                      return (
                        <div
                          key={dateStr}
                          onClick={() => setSelectedDay(date)}
                          className={`bg-background min-h-[100px] p-2 cursor-pointer hover:bg-muted/30 transition-colors ${
                            isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''
                          } ${isSelected ? 'bg-primary/5' : ''}`}
                        >
                          <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-primary' : ''}`}>{format(date, 'd')}</div>
                          <div className="space-y-0.5">
                            {dayBookings.slice(0, 3).map((booking) => (
                              <button
                                key={booking.id}
                                onClick={(e) => { e.stopPropagation(); openBookingDetail(booking); }}
                                className={`w-full text-left p-1 rounded text-xs border-l-2 truncate ${getServiceColor(booking.service_name)}`}
                              >
                                {booking.booking_time} - {booking.service_name.split(' ')[0]}
                              </button>
                            ))}
                            {dayBookings.length > 3 && (
                              <div className="text-[10px] text-muted-foreground px-1">+{dayBookings.length - 3} más</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected day detail below month grid */}
                  {selectedDayBookings.length > 0 && (
                    <div className="border-t p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <List className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm capitalize">{format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{selectedDayBookings.length} reservas · {formatPrice(selectedDayStats.revenue)}</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedDayBookings.map((b) => (
                          <BookingCard
                            key={b.id}
                            booking={b}
                            onAction={handleDayAction}
                            onDetail={openBookingDetail}
                            updatingId={updatingBookingId}
                            onSendOnMyWay={handleSendOnMyWay}
                            sendingOnMyWayId={sendingOnMyWayId}
                            notifiedBookings={notifiedBookings}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Booking Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalle de Reserva</SheetTitle>
            <SheetDescription>
              {selectedBooking && format(parseISO(selectedBooking.booking_date), "EEEE d 'de' MMMM", { locale: es })}
            </SheetDescription>
          </SheetHeader>

          {selectedBooking && (
            <div className="mt-6 space-y-6">
              {/* Time and Service */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{selectedBooking.booking_time}</div>
                  <div className="text-muted-foreground">{selectedBooking.service_name}</div>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex gap-2 flex-wrap">
                {getStatusBadge(selectedBooking.booking_status)}
                {getPaymentBadge(selectedBooking)}
                {selectedBooking.payment_method && (
                  <Badge variant="outline" className="text-xs">{selectedBooking.payment_method}</Badge>
                )}
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase">Cliente</h4>
                <div className="flex items-center py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedBooking.customer_name}</span>
                  </div>
                </div>
                <div className="py-2 border-b">
                  <PhoneAction phone={selectedBooking.customer_phone} />
                </div>
                <div className="flex items-center py-2 border-b">
                  <span className="truncate text-sm">{selectedBooking.customer_email}</span>
                </div>
                <div className="py-2 border-b">
                  <AddressAction address={selectedBooking.address} />
                </div>
              </div>

              {/* Service Details */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase">Servicio</h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span>{selectedBooking.service_name}</span>
                    <span>{formatPrice(selectedBooking.service_price_cents)}</span>
                  </div>
                  {selectedBooking.car_type && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Tipo: {selectedBooking.car_type}</span>
                      {(selectedBooking.car_type_extra_cents ?? 0) > 0 && (
                        <span>+{formatPrice(selectedBooking.car_type_extra_cents)}</span>
                      )}
                    </div>
                  )}
                  {selectedBooking.addons && Array.isArray(selectedBooking.addons) && selectedBooking.addons.length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                        <Sparkles className="w-3 h-3" />
                        <span>Extras</span>
                      </div>
                      {selectedBooking.addons.map((addon, idx) => (
                        <div key={addon.addon_id || idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{addon.name}</span>
                          <span>+{formatPrice(addon.price_cents)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatPrice(selectedBooking.total_cents)}</span>
                  </div>
                </div>
              </div>

              {selectedBooking.notes && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase">Notas</h4>
                  <p className="text-sm bg-muted/30 rounded-lg p-3">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground uppercase">Acciones</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedBooking.payment_status === 'pending' && !selectedBooking.is_subscription_booking && (
                    <Button onClick={() => handleMarkAsPaid(selectedBooking.id)} disabled={isUpdating} className="bg-green-600 hover:bg-green-700">
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                      Marcar Pagado
                    </Button>
                  )}
                  {selectedBooking.booking_status === 'confirmed' && (
                    <Button onClick={() => handleComplete(selectedBooking.id)} disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Completar
                    </Button>
                  )}
                  {selectedBooking.booking_status === 'confirmed' && (
                    <Button variant="destructive" onClick={() => handleCancel(selectedBooking.id)} disabled={isUpdating}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              <div className="pt-4 text-xs text-muted-foreground">ID: {selectedBooking.id}</div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
