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
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import washeroLogo from '@/assets/washero-logo.jpeg';

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

type TabType = 'bookings' | 'notifications';
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
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      const statusLabels = {
        pending: 'pendiente',
        confirmed: 'confirmada',
        completed: 'completada',
        cancelled: 'cancelada',
      };

      toast({
        title: 'Estado actualizado',
        description: `Reserva marcada como ${statusLabels[newStatus]}`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado',
      });
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
      confirmed: 'Confirmada',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentBadge = (status: string, isSubscription: boolean) => {
    if (isSubscription) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Suscripción
        </span>
      );
    }
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      in_process: 'bg-blue-100 text-blue-800',
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Pagado',
      rejected: 'Rechazado',
      in_process: 'En proceso',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
            transition={{ delay: 0.2 }}
            className="bg-background rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
                <p className="text-xs text-muted-foreground">Confirmadas</p>
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
        </div>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Filters */}
            <div className="flex items-center gap-2 mb-4">
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
                   status === 'confirmed' ? 'Confirmadas' :
                   status === 'completed' ? 'Completadas' : 'Canceladas'}
                </button>
              ))}
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
                              <p className="text-xs text-muted-foreground">{booking.customer_email}</p>
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
                            {getPaymentBadge(booking.payment_status, booking.is_subscription_booking)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-1">
                              {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateBookingStatus(booking.id, 'completed')}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {booking.status !== 'cancelled' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="w-4 h-4" />
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Error</th>
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
                            {notification.error_message ? (
                              <span className="text-xs text-red-600">{notification.error_message}</span>
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
      </div>
    </div>
  );
}
