import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  Filter,
  Users,
  XCircle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  subDays, 
  addDays,
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  startOfYear,
  endOfYear,
  subMonths,
  addMonths,
  subWeeks,
  addWeeks,
  subYears,
  addYears,
  parseISO, 
  isWithinInterval 
} from 'date-fns';
import { es } from 'date-fns/locale';

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  service_price_cents: number;
  car_type: string | null;
  car_type_extra_cents: number;
  addons_total_cents?: number;
  total_cents?: number;
  booking_date: string;
  booking_time: string;
  address: string | null;
  notes: string | null;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  is_subscription_booking: boolean;
  requires_payment: boolean;
  created_at: string;
  confirmed_at: string | null;
}

interface FinanzasTabProps {
  bookings: Booking[];
  isLoading: boolean;
  onRefresh: () => void;
}

type PeriodType = 'day' | 'week' | 'month' | 'year';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const formatDate = (date: string) => {
  return format(parseISO(date), 'dd/MM/yyyy', { locale: es });
};

// Payment status helpers
const isPaid = (booking: Booking) => {
  // Cobrados = MP Pagado OR Cobrado (approved)
  return booking.payment_status === 'approved';
};

const isPending = (booking: Booking) => {
  // Pendientes = MP Pendiente OR Por Cobrar (pending)
  return booking.payment_status === 'pending' && booking.status !== 'cancelled';
};

const getPaymentMethodLabel = (booking: Booking) => {
  if (booking.is_subscription_booking) return 'Suscripción';
  if (!booking.requires_payment) return 'Pago en Persona';
  return 'MercadoPago';
};

const getPaymentStatusLabel = (booking: Booking) => {
  if (booking.is_subscription_booking) return 'Suscripción';
  
  if (!booking.requires_payment) {
    return booking.payment_status === 'approved' ? 'Cobrado' : 'Por Cobrar';
  }
  
  const labels: Record<string, string> = {
    pending: 'MP Pendiente',
    approved: 'MP Pagado',
    rejected: 'MP Rechazado',
    in_process: 'MP En proceso',
  };
  return labels[booking.payment_status] || booking.payment_status;
};

const getBookingTotal = (booking: Booking) => {
  if (booking.total_cents) return booking.total_cents;
  return booking.service_price_cents + (booking.car_type_extra_cents || 0) + (booking.addons_total_cents || 0);
};

export function FinanzasTab({ bookings, isLoading, onRefresh }: FinanzasTabProps) {
  const { toast } = useToast();
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [isMarkingPaid, setIsMarkingPaid] = useState<string | null>(null);

  // Get unique services from bookings
  const services = useMemo(() => {
    const serviceSet = new Set(bookings.map(b => b.service_name));
    return Array.from(serviceSet).sort();
  }, [bookings]);

  // Navigate to previous/next period
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1;
    switch (periodType) {
      case 'day':
        setReferenceDate(prev => offset === -1 ? subDays(prev, 1) : addDays(prev, 1));
        break;
      case 'week':
        setReferenceDate(prev => offset === -1 ? subWeeks(prev, 1) : addWeeks(prev, 1));
        break;
      case 'month':
        setReferenceDate(prev => offset === -1 ? subMonths(prev, 1) : addMonths(prev, 1));
        break;
      case 'year':
        setReferenceDate(prev => offset === -1 ? subYears(prev, 1) : addYears(prev, 1));
        break;
    }
  };

  // Go to today/current period
  const goToToday = () => setReferenceDate(new Date());

  // Get period display label
  const getPeriodLabel = useMemo(() => {
    switch (periodType) {
      case 'day':
        return format(referenceDate, "EEEE d 'de' MMMM", { locale: es });
      case 'week':
        const weekStart = startOfWeek(referenceDate, { locale: es, weekStartsOn: 1 });
        const weekEnd = endOfWeek(referenceDate, { locale: es, weekStartsOn: 1 });
        return `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM', { locale: es })}`;
      case 'month':
        return format(referenceDate, 'MMMM yyyy', { locale: es });
      case 'year':
        return format(referenceDate, 'yyyy');
    }
  }, [periodType, referenceDate]);

  // Get date range bounds based on period type
  const getDateBounds = useMemo(() => {
    switch (periodType) {
      case 'day':
        return { start: startOfDay(referenceDate), end: endOfDay(referenceDate) };
      case 'week':
        return { 
          start: startOfWeek(referenceDate, { locale: es, weekStartsOn: 1 }), 
          end: endOfWeek(referenceDate, { locale: es, weekStartsOn: 1 }) 
        };
      case 'month':
        return { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
      case 'year':
        return { start: startOfYear(referenceDate), end: endOfYear(referenceDate) };
    }
  }, [periodType, referenceDate]);

  // Filter bookings by date range and filters
  const filteredBookings = useMemo(() => {
    const { start, end } = getDateBounds;
    
    return bookings.filter(booking => {
      const bookingDate = parseISO(booking.booking_date);
      const inRange = isWithinInterval(bookingDate, { start, end });
      if (!inRange) return false;
      
      // Status filter
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
      
      // Payment status filter
      if (paymentStatusFilter === 'paid' && !isPaid(booking)) return false;
      if (paymentStatusFilter === 'pending' && !isPending(booking)) return false;
      
      // Payment method filter
      if (paymentMethodFilter !== 'all') {
        const method = getPaymentMethodLabel(booking);
        if (paymentMethodFilter === 'mercadopago' && method !== 'MercadoPago') return false;
        if (paymentMethodFilter === 'cash' && method !== 'Pago en Persona') return false;
        if (paymentMethodFilter === 'subscription' && method !== 'Suscripción') return false;
      }
      
      // Service filter
      if (serviceFilter !== 'all' && booking.service_name !== serviceFilter) return false;
      
      return true;
    });
  }, [bookings, getDateBounds, statusFilter, paymentStatusFilter, paymentMethodFilter, serviceFilter]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { locale: es });
    const weekEnd = endOfWeek(now, { locale: es });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Helper to check if a booking is in a date range (non-cancelled)
    const inRange = (booking: Booking, start: Date, end: Date) => {
      if (booking.status === 'cancelled') return false;
      const bookingDate = parseISO(booking.booking_date);
      return isWithinInterval(bookingDate, { start, end });
    };

    // Today's paid bookings
    const todayPaid = bookings
      .filter(b => inRange(b, todayStart, todayEnd) && isPaid(b))
      .reduce((sum, b) => sum + getBookingTotal(b), 0);

    // Today's pending bookings
    const todayPending = bookings
      .filter(b => inRange(b, todayStart, todayEnd) && isPending(b))
      .reduce((sum, b) => sum + getBookingTotal(b), 0);

    // Week's paid bookings
    const weekPaid = bookings
      .filter(b => inRange(b, weekStart, weekEnd) && isPaid(b))
      .reduce((sum, b) => sum + getBookingTotal(b), 0);

    // Month's paid bookings
    const monthPaid = bookings
      .filter(b => inRange(b, monthStart, monthEnd) && isPaid(b))
      .reduce((sum, b) => sum + getBookingTotal(b), 0);

    // Average ticket (from filtered, non-cancelled bookings)
    const completedBookings = filteredBookings.filter(b => 
      b.status !== 'cancelled' && (b.status === 'confirmed' || b.status === 'completed')
    );
    const avgTicket = completedBookings.length > 0
      ? completedBookings.reduce((sum, b) => sum + getBookingTotal(b), 0) / completedBookings.length
      : 0;

    // Total reservations in range
    const totalReservations = filteredBookings.length;

    // Cancelled count and percentage
    const cancelled = filteredBookings.filter(b => b.status === 'cancelled').length;
    const cancelledPct = totalReservations > 0 ? (cancelled / totalReservations * 100) : 0;

    return {
      todayPaid,
      todayPending,
      weekPaid,
      monthPaid,
      avgTicket,
      totalReservations,
      cancelled,
      cancelledPct,
    };
  }, [bookings, filteredBookings]);

  // Revenue per day chart data
  const revenueByDayData = useMemo(() => {
    const { start, end } = getDateBounds;
    const dailyMap = new Map<string, number>();
    
    // Initialize all days in range
    let current = new Date(start);
    while (current <= end) {
      dailyMap.set(format(current, 'yyyy-MM-dd'), 0);
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Sum revenue per day (only paid, non-cancelled)
    filteredBookings
      .filter(b => isPaid(b) && b.status !== 'cancelled')
      .forEach(b => {
        const day = b.booking_date;
        const currentVal = dailyMap.get(day) || 0;
        dailyMap.set(day, currentVal + getBookingTotal(b));
      });
    
    return Array.from(dailyMap.entries())
      .map(([date, amount]) => ({
        date: format(parseISO(date), 'dd/MM', { locale: es }),
        fullDate: date,
        amount: amount / 100,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [filteredBookings, getDateBounds]);

  // Revenue by service chart data
  const revenueByServiceData = useMemo(() => {
    const serviceMap = new Map<string, number>();
    
    filteredBookings
      .filter(b => isPaid(b) && b.status !== 'cancelled')
      .forEach(b => {
        const service = b.service_name;
        const currentVal = serviceMap.get(service) || 0;
        serviceMap.set(service, currentVal + getBookingTotal(b));
      });
    
    return Array.from(serviceMap.entries())
      .map(([name, amount]) => ({
        name,
        amount: amount / 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredBookings]);

  // Payment method share chart data
  const paymentMethodData = useMemo(() => {
    const methodMap = new Map<string, number>();
    
    filteredBookings
      .filter(b => b.status !== 'cancelled')
      .forEach(b => {
        const method = getPaymentMethodLabel(b);
        const currentVal = methodMap.get(method) || 0;
        methodMap.set(method, currentVal + 1);
      });
    
    return Array.from(methodMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredBookings]);

  // Mark as paid handler
  const handleMarkAsPaid = async (bookingId: string) => {
    setIsMarkingPaid(bookingId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          payment_status: 'approved',
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: 'Pago registrado',
        description: 'Reserva marcada como cobrada',
      });

      onRefresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo registrar el pago',
      });
    } finally {
      setIsMarkingPaid(null);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Fecha',
      'Hora',
      'Cliente',
      'Teléfono',
      'Email',
      'Servicio',
      'Total',
      'Método de Pago',
      'Estado Pago',
      'Estado Reserva',
    ];

    const rows = filteredBookings.map(b => [
      formatDate(b.booking_date),
      b.booking_time,
      b.customer_name,
      b.customer_phone,
      b.customer_email,
      b.service_name,
      getBookingTotal(b) / 100,
      getPaymentMethodLabel(b),
      getPaymentStatusLabel(b),
      b.status === 'pending' ? 'Pendiente' :
        b.status === 'confirmed' ? 'Aceptada' :
        b.status === 'completed' ? 'Completada' : 'Cancelada',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `finanzas_washero_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Exportación completada',
      description: `${filteredBookings.length} registros exportados`,
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Aceptada',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentBadge = (booking: Booking) => {
    const label = getPaymentStatusLabel(booking);
    const isPaidStatus = isPaid(booking);
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        isPaidStatus ? 'bg-green-100 text-green-800' : 
        booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
        'bg-yellow-100 text-yellow-800'
      }`}>
        {label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Period Filter + KPI Cards */}
      <div className="space-y-4">
        {/* Period Selector */}
        <div className="bg-background rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Period Type Tabs */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {(['day', 'week', 'month', 'year'] as PeriodType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => { setPeriodType(type); setReferenceDate(new Date()); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    periodType === type 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {type === 'day' ? 'Día' : type === 'week' ? 'Semana' : type === 'month' ? 'Mes' : 'Año'}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigatePeriod('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-[160px] text-center">
                <span className="font-medium capitalize">{getPeriodLabel}</span>
              </div>
              <Button variant="outline" size="icon" onClick={() => navigatePeriod('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToToday}>
                Hoy
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-background rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{formatPrice(kpis.todayPaid)}</p>
                <p className="text-xs text-muted-foreground">Hoy (Cobrados)</p>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-600">{formatPrice(kpis.todayPending)}</p>
                <p className="text-xs text-muted-foreground">Hoy (Pendientes)</p>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatPrice(kpis.weekPaid)}</p>
                <p className="text-xs text-muted-foreground">Semana (Cobrados)</p>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatPrice(kpis.monthPaid)}</p>
                <p className="text-xs text-muted-foreground">Mes (Cobrados)</p>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatPrice(kpis.avgTicket)}</p>
                <p className="text-xs text-muted-foreground">Ticket Promedio</p>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{kpis.totalReservations}</p>
                <p className="text-xs text-muted-foreground">Reservas</p>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{kpis.cancelled} <span className="text-sm font-normal text-muted-foreground">({kpis.cancelledPct.toFixed(1)}%)</span></p>
                <p className="text-xs text-muted-foreground">Canceladas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-background rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado Reserva" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="confirmed">Aceptada</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado Pago" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="paid">Cobrados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Método Pago" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mercadopago">MercadoPago</SelectItem>
              <SelectItem value="cash">Pago en Persona</SelectItem>
              <SelectItem value="subscription">Suscripción</SelectItem>
            </SelectContent>
          </Select>

          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Servicio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {services.map(service => (
                <SelectItem key={service} value={service}>{service}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue per Day Line Chart */}
        <div className="lg:col-span-2 bg-background rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold mb-4">Ingresos por Día (Cobrados)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueByDayData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ingresos']}
                  labelFormatter={(label) => `Fecha: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Pie Chart */}
        <div className="bg-background rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold mb-4">Métodos de Pago</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {paymentMethodData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Revenue by Service Bar Chart */}
      <div className="bg-background rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold mb-4">Ingresos por Servicio (Cobrados)</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByServiceData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`} />
              <YAxis type="category" dataKey="name" className="text-xs" width={120} />
              <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ingresos']} />
              <Bar dataKey="amount" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-background rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Movimientos ({filteredBookings.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Fecha/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Servicio</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Método</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Estado Pago</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Estado Reserva</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No hay movimientos para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm">{formatDate(booking.booking_date)}</p>
                        <p className="text-xs text-muted-foreground">{booking.booking_time} hs</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-sm">{booking.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{booking.customer_phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm">{booking.service_name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-medium text-sm">
                        {formatPrice(getBookingTotal(booking))}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm">{getPaymentMethodLabel(booking)}</span>
                    </td>
                    <td className="px-4 py-4">
                      {getPaymentBadge(booking)}
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(booking.status)}
                    </td>
                    <td className="px-4 py-4">
                      {/* Show Mark as Paid only for pay-later pending bookings */}
                      {!booking.requires_payment && 
                       booking.payment_status === 'pending' && 
                       booking.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkAsPaid(booking.id)}
                          disabled={isMarkingPaid === booking.id}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          {isMarkingPaid === booking.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Cobrar
                            </>
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
