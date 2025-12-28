import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  CreditCard, 
  Bell, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  LogOut,
  RefreshCw,
  Filter,
  DollarSign,
  Eye,
  Phone,
  Mail,
  MapPin,
  Shield,
  Send,
  MessageCircle,
  Loader2
} from 'lucide-react';
import { KipperLeadsTab } from '@/components/admin/KipperLeadsTab';
import { SubscriptionsTab } from '@/components/admin/SubscriptionsTab';
import { CalendarTab } from '@/components/admin/CalendarTab';
import { FinanzasTab } from '@/components/admin/FinanzasTab';
import { MessagesTab } from '@/components/admin/MessagesTab';
import { DisponibilidadTab } from '@/components/admin/DisponibilidadTab';
import { PhoneAction, AddressAction } from '@/components/admin/ContactActions';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import washeroLogo from '@/assets/washero-logo.jpeg';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENTS_ENABLED } from '@/config/payments';
import { sendCustomerNotification } from '@/lib/notifications/sendCustomerNotification';

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  service_price_cents: number;
  car_type: string | null;
  car_type_extra_cents: number;
  booking_date: string;
  booking_time: string;
  address: string | null;
  notes: string | null;
  status: string;
  payment_status: string;
  is_subscription_booking: boolean;
  requires_payment: boolean;
  created_at: string;
  confirmed_at: string | null;
}

interface NotificationLog {
  id: string;
  booking_id: string | null;
  notification_type: string;
  status: string;
  recipient: string;
  message_content: string | null;
  error_message: string | null;
  external_id: string | null;
  created_at: string;
}

type TabType = 'bookings' | 'notifications' | 'kipper' | 'subscriptions' | 'calendario' | 'finanzas' | 'mensajes' | 'disponibilidad';
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<TabType>('bookings');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingTestExternal, setIsSendingTestExternal] = useState(false);
  const [isTestingMP, setIsTestingMP] = useState(false);
  const [isSendingPaymentInstructions, setIsSendingPaymentInstructions] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sendingOnMyWayId, setSendingOnMyWayId] = useState<string | null>(null);
  const [notifiedBookings, setNotifiedBookings] = useState<Set<string>>(new Set());

  const handleSendOnMyWay = async (booking: Booking) => {
    const confirmMsg = `¿Enviar mensaje "Estamos en camino" a ${booking.customer_phone}?`;
    if (!window.confirm(confirmMsg)) return;

    setSendingOnMyWayId(booking.id);
    try {
      const result = await sendCustomerNotification(booking.id, 'ON_MY_WAY');
      
      if (result.ok) {
        toast({
          title: 'Mensaje encolado ✅',
          description: result.sent 
            ? 'WhatsApp enviado correctamente' 
            : 'Mensaje guardado para envío posterior',
        });
        // Mark as notified for 10 minutes
        setNotifiedBookings(prev => new Set(prev).add(booking.id));
        setTimeout(() => {
          setNotifiedBookings(prev => {
            const next = new Set(prev);
            next.delete(booking.id);
            return next;
          });
        }, 10 * 60 * 1000);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo enviar la notificación',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Error enviando notificación',
      });
    } finally {
      setSendingOnMyWayId(null);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      // Fetch notification logs
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notification_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (notificationsError) {
        console.error('Error fetching notifications:', notificationsError);
        throw notificationsError;
      }

      setBookings(bookingsData || []);
      setNotifications(notificationsData || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los datos',
      });
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchData().finally(() => setIsLoading(false));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    toast({
      title: 'Actualizado',
      description: 'Datos actualizados correctamente',
    });
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
    try {
      const updateData: any = { status: newStatus };
      
      // If confirming, also set confirmed_at
      if (newStatus === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (error) throw error;

      const statusLabels = {
        pending: 'pendiente',
        confirmed: 'aceptada',
        completed: 'completada',
        cancelled: 'cancelada',
      };

      toast({
        title: 'Estado actualizado',
        description: `Reserva marcada como ${statusLabels[newStatus]}`,
      });

      fetchData();
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado',
      });
    }
  };

  const handleMarkAsPaid = async (bookingId: string) => {
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
        description: 'Reserva marcada como pagada y confirmada',
      });

      fetchData();
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo registrar el pago',
      });
    }
  };

  const handleSendTestNotification = async () => {
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: { testMode: true },
      });

      if (error) throw error;

      const emailStatus = data?.results?.email?.success 
        ? `✅ Enviado (ID: ${data?.results?.email?.id?.substring(0, 12)}...)` 
        : `❌ ${data?.results?.email?.error || 'Error'}`;
      const whatsappStatus = data?.results?.whatsapp?.success 
        ? `✅ Enviado (SID: ${data?.results?.whatsapp?.sid?.substring(0, 12)}...)` 
        : `❌ ${data?.results?.whatsapp?.error || 'Error'}`;
      
      const description = `Email: ${emailStatus}\nWhatsApp: ${whatsappStatus}`;

      toast({
        title: data?.results?.email?.success && data?.results?.whatsapp?.success 
          ? 'Test enviado correctamente' 
          : 'Test enviado con errores',
        description: description,
        duration: 8000,
      });

      // Refresh notification logs
      fetchData();
    } catch (error: any) {
      console.error('Test notification error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo enviar la notificación de prueba',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendTestEmailExternal = async () => {
    setIsSendingTestExternal(true);
    try {
      // Send to a different email to test production sending
      const testEmail = 'salvadormarinkipper@gmail.com';
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: { testMode: true, testEmailTo: testEmail },
      });

      if (error) throw error;

      const emailStatus = data?.results?.email?.success 
        ? `✅ Enviado a ${testEmail} (ID: ${data?.results?.email?.id?.substring(0, 12)}...)` 
        : `❌ ${data?.results?.email?.error || 'Error'}`;
      
      toast({
        title: data?.results?.email?.success 
          ? 'Email externo enviado' 
          : 'Error enviando email externo',
        description: emailStatus,
        duration: 10000,
      });

      // Refresh notification logs
      fetchData();
    } catch (error: any) {
      console.error('Test email error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo enviar el email de prueba',
      });
    } finally {
      setIsSendingTestExternal(false);
    }
  };

  const handleTestMercadoPago = async () => {
    setIsTestingMP(true);
    try {
      // First, get a recent pending booking to test with
      const { data: pendingBookings, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      let testBookingId: string;
      
      if (pendingBookings && pendingBookings.length > 0) {
        testBookingId = pendingBookings[0].id;
        toast({
          title: 'Usando reserva existente',
          description: `ID: ${testBookingId.substring(0, 8).toUpperCase()}`,
        });
      } else {
        // Create a test booking
        const { data: bookingResponse, error: bookingError } = await supabase.functions.invoke(
          'create-booking',
          {
            body: {
              customerName: 'Test MercadoPago',
              customerEmail: 'test@washero.online',
              customerPhone: '1155555555',
              serviceName: 'Lavado Exterior',
              servicePriceCents: 2500000,
              carType: 'Sedán',
              carTypeExtraCents: 0,
              bookingDate: new Date().toISOString().split('T')[0],
              bookingTime: '10:00',
              address: 'Test Address',
              notes: 'Test MP Payment',
              paymentMethod: 'mercadopago',
              paymentsEnabled: true,
              whatsappOptIn: false,
            },
          }
        );

        if (bookingError) throw new Error('Error creando booking de test');
        testBookingId = bookingResponse.booking.id;
      }

      // Create MercadoPago preference
      const { data: mpResponse, error: mpError } = await supabase.functions.invoke(
        'create-mercadopago-preference',
        {
          body: {
            bookingId: testBookingId,
            title: 'TEST - Washero Lavado',
            description: 'Test payment - do not pay',
            priceInCents: 100, // $1 ARS for testing
            customerEmail: 'test@washero.online',
            customerName: 'Test User',
          },
        }
      );

      if (mpError) throw mpError;

      console.log('[Admin] MP Test Response:', mpResponse);

      toast({
        title: '✅ Preferencia MP creada',
        description: `
Preference ID: ${mpResponse.preferenceId?.substring(0, 16)}...
Environment: ${mpResponse.environment}
Init Point: ${mpResponse.initPoint ? '✓ Available' : '✗ Missing'}
        `.trim(),
        duration: 15000,
      });

      // Open MP checkout in new tab for testing
      if (mpResponse.initPoint) {
        window.open(mpResponse.initPoint, '_blank');
      }

      fetchData();
    } catch (error: any) {
      console.error('Test MP error:', error);
      toast({
        variant: 'destructive',
        title: 'Error testing MercadoPago',
        description: error.message || 'No se pudo crear la preferencia de pago',
      });
    } finally {
      setIsTestingMP(false);
    }
  };

  const handleSendPaymentInstructions = async (bookingId: string) => {
    setIsSendingPaymentInstructions(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: { bookingId, messageType: 'payment_instructions' },
      });
      if (error) throw error;
      const success = data?.results?.customerEmail?.success;
      toast({
        title: success ? '✅ Instrucciones enviadas' : '❌ Error',
        description: success 
          ? `Email enviado a ${data?.results?.customerEmail?.to || 'cliente'}`
          : data?.results?.customerEmail?.error || 'No se pudo enviar',
        variant: success ? 'default' : 'destructive',
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudieron enviar las instrucciones',
      });
    } finally {
      setIsSendingPaymentInstructions(false);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (statusFilter === 'all') return true;
    return booking.status === statusFilter;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    pendingPayment: bookings.filter(b => b.payment_status === 'pending' && b.status !== 'cancelled').length,
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    // Spanish labels: Aceptada for confirmed (operational meaning)
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

  const getPaymentBadge = (status: string, isSubscription: boolean, requiresPayment: boolean) => {
    if (isSubscription) {
      return (
        <div className="flex flex-col gap-1">
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Suscripción
          </span>
        </div>
      );
    }
    if (!requiresPayment) {
      // Pay Later booking
      const isPaid = status === 'approved';
      return (
        <div className="flex flex-col gap-1">
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Pago en Persona
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isPaid ? 'Cobrado' : 'Por Cobrar'}
          </span>
        </div>
      );
    }
    // MercadoPago booking
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      in_process: 'bg-blue-100 text-blue-800',
    };
    const labels: Record<string, string> = {
      pending: 'MP Pendiente',
      approved: 'MP Pagado',
      rejected: 'MP Rechazado',
      in_process: 'MP En proceso',
    };
    return (
      <div className="flex flex-col gap-1">
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          MercadoPago
        </span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
          {labels[status] || status}
        </span>
      </div>
    );
  };

  const getNotificationIcon = (type: string, status: string) => {
    const isSuccess = status === 'sent';
    const Icon = isSuccess ? CheckCircle : XCircle;
    const color = isSuccess ? 'text-green-500' : 'text-red-500';
    
    return (
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="capitalize">{type}</span>
      </div>
    );
  };

  const openBookingDetail = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-washero-charcoal text-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={washeroLogo} alt="Washero" className="w-10 h-10 rounded-lg object-cover" />
              <div>
                <h1 className="font-display text-xl font-bold">Panel Admin</h1>
                <p className="text-sm text-background/70">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!PAYMENTS_ENABLED && (
                <span className="px-3 py-1 bg-orange-500/20 text-orange-200 text-xs rounded-full">
                  Modo Sin Pagos
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-background hover:bg-background/10"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-background hover:bg-background/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-background rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-background rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-background rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingPayment}</p>
                <p className="text-xs text-muted-foreground">Sin Pago</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-background rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
                <p className="text-xs text-muted-foreground">Aceptadas</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-background rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-background rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.cancelled}</p>
                <p className="text-xs text-muted-foreground">Canceladas</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'bookings' ? 'default' : 'outline'}
            onClick={() => setActiveTab('bookings')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Reservas
          </Button>
          <Button
            variant={activeTab === 'notifications' ? 'default' : 'outline'}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell className="w-4 h-4 mr-2" />
            Notificaciones
          </Button>
          <Button
            variant={activeTab === 'kipper' ? 'default' : 'outline'}
            onClick={() => setActiveTab('kipper')}
            className={activeTab === 'kipper' ? 'bg-[#8B1E2F] hover:bg-[#6B1726]' : ''}
          >
            <Shield className="w-4 h-4 mr-2" />
            Leads Kipper
          </Button>
          <Button
            variant={activeTab === 'subscriptions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('subscriptions')}
          >
            <Users className="w-4 h-4 mr-2" />
            Suscripciones
          </Button>
          <Button
            variant={activeTab === 'calendario' ? 'default' : 'outline'}
            onClick={() => setActiveTab('calendario')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Calendario
          </Button>
          <Button
            variant={activeTab === 'finanzas' ? 'default' : 'outline'}
            onClick={() => setActiveTab('finanzas')}
            className={activeTab === 'finanzas' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Finanzas
          </Button>
          <Button
            variant={activeTab === 'mensajes' ? 'default' : 'outline'}
            onClick={() => setActiveTab('mensajes')}
            className={activeTab === 'mensajes' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Mensajes
          </Button>
          <Button
            variant={activeTab === 'disponibilidad' ? 'default' : 'outline'}
            onClick={() => setActiveTab('disponibilidad')}
            className={activeTab === 'disponibilidad' ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            <Clock className="w-4 h-4 mr-2" />
            Disponibilidad
          </Button>
        </div>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* MP Test + Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filtrar:</span>
                {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as StatusFilter[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      statusFilter === status
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {status === 'all' ? 'Todas' : 
                     status === 'pending' ? 'Pendientes' :
                     status === 'confirmed' ? 'Aceptadas' :
                     status === 'completed' ? 'Completadas' : 'Canceladas'}
                  </button>
                ))}
              </div>
              {PAYMENTS_ENABLED && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestMercadoPago}
                  disabled={isTestingMP}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {isTestingMP ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Test MP Payment
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Bookings Table */}
            <div className="bg-background rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Servicio</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Fecha/Hora</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pago</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                          Cargando...
                        </td>
                      </tr>
                    ) : filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                          No hay reservas
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-muted/30">
                          <td className="px-4 py-4">
                            <span className="font-mono text-xs">{booking.id.substring(0, 8).toUpperCase()}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-sm">{booking.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{booking.customer_phone}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm">{booking.service_name}</p>
                            {booking.car_type && (
                              <p className="text-xs text-muted-foreground">{booking.car_type}</p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm">{formatDate(booking.booking_date)}</p>
                            <p className="text-xs text-muted-foreground">{booking.booking_time} hs</p>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-medium text-sm">
                              {formatPrice(booking.service_price_cents + (booking.car_type_extra_cents || 0))}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {getStatusBadge(booking.status)}
                          </td>
                          <td className="px-4 py-4">
                            {getPaymentBadge(booking.payment_status, booking.is_subscription_booking, booking.requires_payment)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openBookingDetail(booking)}
                                className="text-primary hover:text-primary/80"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {/* Aceptar: only for pending bookings - moves to calendar */}
                              {booking.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Aceptar (aparece en calendario)"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {/* Marcar pagado: only if payment pending */}
                              {booking.payment_status === 'pending' && booking.status !== 'cancelled' && !booking.is_subscription_booking && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMarkAsPaid(booking.id)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Marcar como pagado"
                                >
                                  <DollarSign className="w-4 h-4" />
                                </Button>
                              )}
                              {/* Completar: only for confirmed/accepted bookings - removes from calendar */}
                              {booking.status === 'confirmed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateBookingStatus(booking.id, 'completed')}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Completar (desaparece del calendario)"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {/* Cancelar: for pending or confirmed */}
                              {(booking.status === 'pending' || booking.status === 'confirmed') && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Cancelar reserva"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {/* En camino: for confirmed bookings */}
                              {booking.status === 'confirmed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSendOnMyWay(booking)}
                                  disabled={sendingOnMyWayId === booking.id}
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  title="Enviar 'En camino'"
                                >
                                  {sendingOnMyWayId === booking.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : notifiedBookings.has(booking.id) ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* WhatsApp Mode Info + Test Button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">WhatsApp Mode:</span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Sandbox
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  En sandbox, solo admin recibe WhatsApp. Clientes reciben email.
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendTestNotification}
                  disabled={isSendingTest}
                >
                  {isSendingTest ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Test Admin
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSendTestEmailExternal}
                  disabled={isSendingTestExternal}
                  className="bg-primary"
                >
                  {isSendingTestExternal ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Test Email Externo
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Info banner about domain */}
            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
              <p className="font-medium text-blue-800 mb-1">📧 Verificar dominio: washero.online</p>
              <p className="text-blue-700 text-xs">
                Asegurate de que RESEND_FROM_EMAIL esté configurado como "Washero &lt;reservas@washero.online&gt;" y que la API Key corresponda a la cuenta donde washero.online está verificado.
              </p>
            </div>
            
            <div className="bg-background rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Destinatario</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Reserva</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ID Externo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          Cargando...
                        </td>
                      </tr>
                    ) : notifications.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          No hay notificaciones
                        </td>
                      </tr>
                    ) : (
                      notifications.map((notification) => (
                        <tr key={notification.id} className="hover:bg-muted/30">
                          <td className="px-4 py-4">
                            <span className="text-sm">{formatDateTime(notification.created_at)}</span>
                          </td>
                          <td className="px-4 py-4">
                            {getNotificationIcon(notification.notification_type, notification.status)}
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm font-mono">{notification.recipient}</span>
                          </td>
                          <td className="px-4 py-4">
                            {notification.booking_id ? (
                              <span className="font-mono text-xs">
                                {notification.booking_id.substring(0, 8).toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              notification.status === 'sent' 
                                ? 'bg-green-100 text-green-800' 
                                : notification.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {notification.status === 'sent' ? 'Enviado' : 
                               notification.status === 'failed' ? 'Fallido' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {notification.external_id ? (
                              <span className="font-mono text-xs text-green-600">{notification.external_id.substring(0, 16)}...</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {notification.error_message ? (
                              <span className="text-xs text-red-600">{notification.error_message}</span>
                            ) : notification.message_content ? (
                              <span className="text-xs text-muted-foreground">{notification.message_content}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
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
        )}

        {/* Kipper Leads Tab */}
        {activeTab === 'kipper' && <KipperLeadsTab />}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && <SubscriptionsTab />}

        {/* Calendario Tab */}
        {activeTab === 'calendario' && <CalendarTab />}

        {/* Finanzas Tab */}
        {activeTab === 'finanzas' && (
          <FinanzasTab 
            bookings={bookings} 
            isLoading={isLoading} 
            onRefresh={fetchData} 
          />
        )}

        {/* Mensajes Tab */}
        {activeTab === 'mensajes' && <MessagesTab />}
      </div>

      {/* Booking Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Detalle de Reserva</DialogTitle>
            <DialogDescription>
              ID: {selectedBooking?.id.substring(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-3">Cliente</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedBooking.customer_name}</span>
                  </div>
                  <PhoneAction phone={selectedBooking.customer_phone} />
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${selectedBooking.customer_email}`} className="text-primary hover:underline">
                      {selectedBooking.customer_email}
                    </a>
                  </div>
                  <AddressAction address={selectedBooking.address} />
                </div>
              </div>

              {/* Service Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-3">Servicio</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Servicio</span>
                    <span className="font-medium">{selectedBooking.service_name}</span>
                  </div>
                  {selectedBooking.car_type && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehículo</span>
                      <span className="font-medium">{selectedBooking.car_type}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha</span>
                    <span className="font-medium">{formatDate(selectedBooking.booking_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hora</span>
                    <span className="font-medium">{selectedBooking.booking_time} hs</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 mt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-primary">
                      {formatPrice(selectedBooking.service_price_cents + (selectedBooking.car_type_extra_cents || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedBooking.notes && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Notas</h4>
                  <p className="text-sm text-muted-foreground">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Estado:</span>
                  {getStatusBadge(selectedBooking.status)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Pago:</span>
                  {getPaymentBadge(selectedBooking.payment_status, selectedBooking.is_subscription_booking, selectedBooking.requires_payment)}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            {selectedBooking && selectedBooking.payment_status === 'pending' && selectedBooking.status !== 'cancelled' && !selectedBooking.is_subscription_booking && (
              <Button
                onClick={() => handleSendPaymentInstructions(selectedBooking.id)}
                disabled={isSendingPaymentInstructions}
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                {isSendingPaymentInstructions ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Enviar Instrucciones de Pago
              </Button>
            )}
            {selectedBooking && selectedBooking.payment_status === 'pending' && selectedBooking.status !== 'cancelled' && (
              <Button
                onClick={() => handleMarkAsPaid(selectedBooking.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Marcar como Pagado
              </Button>
            )}
            {selectedBooking && selectedBooking.status === 'pending' && (
              <Button
                onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'confirmed')}
                variant="default"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar
              </Button>
            )}
            {selectedBooking && selectedBooking.status !== 'cancelled' && (
              <Button
                onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'cancelled')}
                variant="destructive"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
