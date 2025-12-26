import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Search,
  X,
  Clock,
  CreditCard,
  Users,
  Loader2,
  CheckCircle,
  RefreshCw,
  Sparkles
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PhoneAction, AddressAction } from '@/components/admin/ContactActions';
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
  service_price_cents: number;
  car_type_extra_cents: number;
  addons: AddonItem[] | null;
  addons_total_cents: number | null;
  total_cents: number;
  booking_status: string;
  payment_status: string;
  payment_method: string | null;
  subscription_id: string | null;
  is_subscription_booking: boolean;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
}

type ViewMode = 'day' | 'week' | 'month';

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const getPaymentBadge = (booking: CalendarBooking) => {
  if (booking.is_subscription_booking) {
    return <Badge variant="secondary" className="bg-purple-100 text-purple-800">SUB</Badge>;
  }
  
  const statusMap: Record<string, { className: string; label: string }> = {
    approved: { className: 'bg-green-100 text-green-800', label: 'Pagado' },
    pending: { className: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
    rejected: { className: 'bg-red-100 text-red-800', label: 'Rechazado' },
  };
  
  const config = statusMap[booking.payment_status] || { className: 'bg-gray-100 text-gray-800', label: booking.payment_status };
  return <Badge variant="secondary" className={config.className}>{config.label}</Badge>;
};

const getServiceColor = (serviceName: string): string => {
  const name = serviceName.toLowerCase();
  if (name.includes('premium') || name.includes('completo')) return 'border-l-purple-500 bg-purple-50';
  if (name.includes('interior')) return 'border-l-blue-500 bg-blue-50';
  if (name.includes('exterior')) return 'border-l-green-500 bg-green-50';
  return 'border-l-gray-500 bg-gray-50';
};

const getAddonsCount = (booking: CalendarBooking): number => {
  if (!booking.addons || !Array.isArray(booking.addons)) return 0;
  return booking.addons.length;
};

export function CalendarTab() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
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

  // Calculate date range based on view mode
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

      if (!token) {
        throw new Error('No session token');
      }

      const response = await supabase.functions.invoke('admin-get-calendar-bookings', {
        body: {
          from: format(dateRange.from, 'yyyy-MM-dd'),
          to: format(dateRange.to, 'yyyy-MM-dd'),
          subscription_only: subscriptionOnly,
          search: searchTerm || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setBookings(response.data?.bookings || []);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error fetching calendar bookings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las reservas del calendario',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateRange.from, dateRange.to, subscriptionOnly, searchTerm, toast]);

  useEffect(() => {
    fetchCalendarBookings();
  }, [fetchCalendarBookings]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== undefined) {
        fetchCalendarBookings(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Real-time subscription to bookings table
  useEffect(() => {
    const channel = supabase
      .channel('admin-calendar-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        (payload) => {
          console.log('Booking change detected:', payload);
          // Refetch when any booking changes
          fetchCalendarBookings(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCalendarBookings]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCalendarBookings(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchCalendarBookings]);

  const navigatePrev = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, -1));
        break;
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(subMonths(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Group bookings by date for rendering
  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, CalendarBooking[]> = {};
    bookings.forEach((booking) => {
      const date = booking.booking_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(booking);
    });
    // Sort bookings within each date by time
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => a.booking_time.localeCompare(b.booking_time));
    });
    return grouped;
  }, [bookings]);

  // Generate array of dates for current view
  const viewDates = useMemo(() => {
    const dates: Date[] = [];
    let current = dateRange.from;
    while (current <= dateRange.to) {
      dates.push(current);
      current = addDays(current, 1);
    }
    return dates;
  }, [dateRange]);

  const handleMarkAsPaid = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: 'approved' })
        .eq('id', bookingId);

      if (error) throw error;

      toast({ title: 'Pago marcado', description: 'La reserva fue marcada como pagada' });
      fetchCalendarBookings();
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleComplete = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);

      if (error) throw error;

      toast({ title: 'Reserva completada', description: 'El servicio fue marcado como completado' });
      fetchCalendarBookings();
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;

      toast({ title: 'Reserva cancelada', description: 'La reserva fue cancelada' });
      fetchCalendarBookings();
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado', description: `${label} copiado al portapapeles` });
  };

  const openBookingDetail = (booking: CalendarBooking) => {
    setSelectedBooking(booking);
    setIsDetailOpen(true);
  };

  const getDateTitle = () => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, "EEEE d 'de' MMMM, yyyy", { locale: es });
      case 'week':
        return `${format(dateRange.from, "d MMM", { locale: es })} - ${format(dateRange.to, "d MMM, yyyy", { locale: es })}`;
      case 'month':
        return format(currentDate, "MMMM yyyy", { locale: es });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-4 capitalize">{getDateTitle()}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode selector */}
          <div className="flex bg-muted rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === mode ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                }`}
              >
                {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-48"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Subscription filter */}
          <Button
            variant={subscriptionOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSubscriptionOnly(!subscriptionOnly)}
          >
            <Users className="h-4 w-4 mr-1" />
            Suscripciones
          </Button>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCalendarBookings(false)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Last updated indicator */}
      <div className="flex items-center justify-end mb-2 text-xs text-muted-foreground">
        <span>Última actualización: {format(lastUpdated, 'HH:mm:ss', { locale: es })}</span>
        {bookings.length > 0 && (
          <span className="ml-4">
            {bookings.length} reserva{bookings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="bg-background rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === 'month' ? (
          /* Month View - Grid */
          <div className="grid grid-cols-7 gap-px bg-border">
            {/* Header */}
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {/* Days */}
            {viewDates.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayBookings = bookingsByDate[dateStr] || [];
              const isCurrentDay = isToday(date);
              
              return (
                <div
                  key={dateStr}
                  className={`bg-background min-h-[100px] p-2 ${isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''}`}
                >
                  <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-primary' : ''}`}>
                    {format(date, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map((booking) => {
                      const addonsCount = getAddonsCount(booking);
                      return (
                        <button
                          key={booking.id}
                          onClick={() => openBookingDetail(booking)}
                          className={`w-full text-left p-1 rounded text-xs border-l-2 truncate ${getServiceColor(booking.service_name)}`}
                        >
                          {booking.booking_time} - {booking.service_name.split(' ')[0]}
                          {addonsCount > 0 && ` (+${addonsCount})`}
                        </button>
                      );
                    })}
                    {dayBookings.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayBookings.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Day/Week View - List */
          <div className={viewMode === 'week' ? 'grid grid-cols-7 gap-px bg-border' : ''}>
            {viewDates.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayBookings = bookingsByDate[dateStr] || [];
              const isCurrentDay = isToday(date);

              return (
                <div
                  key={dateStr}
                  className={`bg-background ${viewMode === 'week' ? 'min-h-[400px]' : ''} ${
                    isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''
                  }`}
                >
                  {/* Day header */}
                  <div className={`p-3 border-b ${isCurrentDay ? 'bg-primary/5' : 'bg-muted/30'}`}>
                    <div className="text-sm font-medium capitalize">
                      {format(date, 'EEEE', { locale: es })}
                    </div>
                    <div className={`text-2xl font-bold ${isCurrentDay ? 'text-primary' : ''}`}>
                      {format(date, 'd')}
                    </div>
                  </div>

                  {/* Bookings */}
                  <div className="p-2 space-y-2">
                    {dayBookings.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        Sin reservas
                      </div>
                    ) : (
                      dayBookings.map((booking) => {
                        const addonsCount = getAddonsCount(booking);
                        return (
                          <button
                            key={booking.id}
                            onClick={() => openBookingDetail(booking)}
                            className={`w-full text-left p-3 rounded-lg border-l-4 hover:shadow-md transition-shadow ${getServiceColor(
                              booking.service_name
                            )}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-sm">{booking.booking_time}</span>
                              <div className="flex items-center gap-1">
                                {addonsCount > 0 && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    <Sparkles className="w-3 h-3 mr-0.5" />
                                    +{addonsCount}
                                  </Badge>
                                )}
                                {getPaymentBadge(booking)}
                              </div>
                            </div>
                            <div className="text-sm font-medium truncate">{booking.customer_name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {booking.service_name} • {formatPrice(booking.total_cents)}
                            </div>
                            {booking.address && (
                              <div className="text-xs text-muted-foreground truncate mt-1">
                                📍 {booking.address}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                <Badge variant={selectedBooking.booking_status === 'confirmed' ? 'default' : 'secondary'}>
                  {selectedBooking.booking_status === 'confirmed' ? 'Aceptada' : 
                   selectedBooking.booking_status === 'completed' ? 'Completada' : 
                   selectedBooking.booking_status === 'pending' ? 'Pendiente' :
                   selectedBooking.booking_status === 'cancelled' ? 'Cancelada' :
                   selectedBooking.booking_status}
                </Badge>
                {getPaymentBadge(selectedBooking)}
                {selectedBooking.payment_method && (
                  <Badge variant="outline">{selectedBooking.payment_method}</Badge>
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
                      {selectedBooking.car_type_extra_cents > 0 && (
                        <span>+{formatPrice(selectedBooking.car_type_extra_cents)}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Add-ons section */}
                  {selectedBooking.addons && Array.isArray(selectedBooking.addons) && selectedBooking.addons.length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                        <Sparkles className="w-3 h-3" />
                        <span>Servicios adicionales</span>
                      </div>
                      {selectedBooking.addons.map((addon, idx) => (
                        <div key={addon.addon_id || idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{addon.name}</span>
                          <span>+{formatPrice(addon.price_cents)}</span>
                        </div>
                      ))}
                      {selectedBooking.addons_total_cents && selectedBooking.addons_total_cents > 0 && (
                        <div className="flex justify-between text-sm font-medium pt-1">
                          <span>Subtotal extras</span>
                          <span>{formatPrice(selectedBooking.addons_total_cents)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* No add-ons indicator */}
                  {(!selectedBooking.addons || !Array.isArray(selectedBooking.addons) || selectedBooking.addons.length === 0) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                      <span>Sin servicios adicionales</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatPrice(selectedBooking.total_cents)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
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
                  {/* Marcar pagado: only if payment pending and not subscription */}
                  {selectedBooking.payment_status === 'pending' && !selectedBooking.is_subscription_booking && (
                    <Button
                      onClick={() => handleMarkAsPaid(selectedBooking.id)}
                      disabled={isUpdating}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                      Marcar Pagado
                    </Button>
                  )}
                  
                  {/* Completar: only for confirmed/accepted bookings - removes from calendar */}
                  {selectedBooking.booking_status === 'confirmed' && (
                    <Button
                      onClick={() => handleComplete(selectedBooking.id)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Completar
                    </Button>
                  )}

                  {/* Cancelar: for confirmed bookings */}
                  {selectedBooking.booking_status === 'confirmed' && (
                    <Button
                      variant="destructive"
                      onClick={() => handleCancel(selectedBooking.id)}
                      disabled={isUpdating}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                
                {/* Info about what happens */}
                {selectedBooking.booking_status === 'confirmed' && (
                  <p className="text-xs text-muted-foreground">
                    Al completar o cancelar, la reserva desaparecerá del calendario.
                  </p>
                )}
              </div>

              {/* Booking ID */}
              <div className="pt-4 text-xs text-muted-foreground">
                ID: {selectedBooking.id}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
