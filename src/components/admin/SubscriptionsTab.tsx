import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Pause,
  Play,
  Mail,
  Phone,
  Loader2,
  Eye,
  Send,
  Plus,
  Minus,
  Search,
  History,
  Calendar,
  CreditCard,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

interface Subscription {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  washes_remaining: number;
  washes_used_in_cycle: number;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  plan_id: string;
  subscription_plans?: {
    name: string;
    washes_per_month: number;
    price_cents: number;
  };
}

interface SubscriptionEvent {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: any;
  created_at: string;
}

// Canonical status values (must match DB enum)
const SUBSCRIPTION_STATUSES = {
  pending: 'pending',
  active: 'active',
  paused: 'paused',
  cancelled: 'cancelled',
  payment_failed: 'payment_failed',
} as const;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente aprobación',
  pending_approval: 'Pendiente aprobación',
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  payment_failed: 'Pago fallido',
  declined: 'Rechazada',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  created: 'Creada',
  activated: 'Activada',
  status_changed: 'Estado cambiado',
  credits_adjusted: 'Créditos ajustados',
  cycle_generated: 'Nuevo ciclo',
  payment_email_sent: 'Email de pago enviado',
  wash_used: 'Lavado usado',
  renewed: 'Renovada',
  paused: 'Pausada',
  resumed: 'Reanudada',
  cancelled: 'Cancelada',
};

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

export function SubscriptionsTab() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [creditsDelta, setCreditsDelta] = useState<number>(0);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            washes_per_month,
            price_cents
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las suscripciones',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchEvents = useCallback(async (subscriptionId: string) => {
    setIsLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('subscription_events')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    if (selectedSubscription) {
      fetchEvents(selectedSubscription.id);
    }
  }, [selectedSubscription, fetchEvents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSubscriptions();
    setIsRefreshing(false);
    toast({
      title: 'Actualizado',
      description: 'Datos actualizados',
    });
  };

  const handleUpdateStatus = async (subscriptionId: string, newStatus: string) => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-set-subscription-status', {
        body: {
          subscription_id: subscriptionId,
          status: newStatus,
          reset_credits: newStatus === SUBSCRIPTION_STATUSES.active,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Error desconocido');

      toast({
        title: 'Estado actualizado',
        description: data.message || `Suscripción ${STATUS_LABELS[newStatus] || newStatus}`,
      });

      await fetchSubscriptions();
      if (selectedSubscription) {
        fetchEvents(selectedSubscription.id);
      }
    } catch (error: any) {
      console.error('[SubscriptionsTab] Update status error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar el estado',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAdjustCredits = async (subscriptionId: string, delta: number) => {
    if (delta === 0) return;
    
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-adjust-subscription-credits', {
        body: {
          subscription_id: subscriptionId,
          delta,
          reason: 'Ajuste manual desde panel admin',
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Error desconocido');

      toast({
        title: 'Créditos ajustados',
        description: data.message || `Ahora tiene ${data.new_credits} lavados disponibles`,
      });

      await fetchSubscriptions();
      setCreditsDelta(0);
      
      if (selectedSubscription && selectedSubscription.id === subscriptionId) {
        setSelectedSubscription(prev => prev ? { ...prev, washes_remaining: data.new_credits } : null);
        fetchEvents(subscriptionId);
      }
    } catch (error: any) {
      console.error('[SubscriptionsTab] Adjust credits error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudieron ajustar los créditos',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendPaymentEmail = async (subscription: Subscription) => {
    setIsSendingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-send-subscription-payment-email', {
        body: {
          subscription_id: subscription.id,
          mode: 'manual',
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Error desconocido');

      toast({
        title: 'Email enviado',
        description: data.message || `Instrucciones de pago enviadas a ${subscription.customer_email}`,
      });

      await fetchSubscriptions();
      if (selectedSubscription) {
        fetchEvents(selectedSubscription.id);
      }
    } catch (error: any) {
      console.error('[SubscriptionsTab] Send payment email error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo enviar el email',
      });
    } finally {
      setIsSendingPayment(false);
    }
  };

  const handleGenerateNewCycle = async (subscription: Subscription) => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-generate-cycle', {
        body: {
          subscription_id: subscription.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Error desconocido');

      toast({
        title: data.created ? 'Nuevo ciclo generado' : 'Ciclo existente',
        description: data.message,
      });

      await fetchSubscriptions();
      if (selectedSubscription) {
        fetchEvents(selectedSubscription.id);
      }
    } catch (error: any) {
      console.error('[SubscriptionsTab] Generate cycle error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo generar el nuevo ciclo',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter(sub => {
    // Status filter
    if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        sub.customer_name?.toLowerCase().includes(query) ||
        sub.customer_email?.toLowerCase().includes(query) ||
        sub.customer_phone?.includes(query)
      );
    }
    
    return true;
  });

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === SUBSCRIPTION_STATUSES.active).length,
    pending: subscriptions.filter(s => s.status === SUBSCRIPTION_STATUSES.pending).length,
    paused: subscriptions.filter(s => s.status === SUBSCRIPTION_STATUSES.paused).length,
    cancelled: subscriptions.filter(s => s.status === SUBSCRIPTION_STATUSES.cancelled).length,
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      paused: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-red-100 text-red-800',
      payment_failed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {STATUS_LABELS[status] || status}
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
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-muted-foreground">Activas</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-muted-foreground">Pendientes</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-orange-600">{stats.paused}</div>
          <div className="text-sm text-muted-foreground">Pausadas</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          <div className="text-sm text-muted-foreground">Canceladas</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Status filter dropdown (mobile friendly) */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="paused">Pausadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Actualizar</span>
        </Button>
      </div>

      {/* Subscriptions list - Mobile Cards / Desktop Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Plan</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Créditos</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fecha</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No hay suscripciones
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="font-medium text-foreground">{sub.customer_name}</div>
                      <div className="text-sm text-muted-foreground">{sub.customer_email}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-foreground">{sub.subscription_plans?.name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatPrice(sub.subscription_plans?.price_cents || 0)}/mes
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(sub.status)}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-foreground">
                        {sub.washes_remaining} / {sub.subscription_plans?.washes_per_month || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {sub.washes_used_in_cycle} usados
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatDate(sub.created_at)}
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSubscription(sub);
                          setCreditsDelta(0);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y">
          {filteredSubscriptions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No hay suscripciones
            </div>
          ) : (
            filteredSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="p-4 active:bg-muted/30 cursor-pointer"
                onClick={() => {
                  setSelectedSubscription(sub);
                  setCreditsDelta(0);
                  setIsDetailOpen(true);
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-foreground">{sub.customer_name}</div>
                    <div className="text-sm text-muted-foreground">{sub.subscription_plans?.name}</div>
                  </div>
                  {getStatusBadge(sub.status)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {sub.washes_remaining}/{sub.subscription_plans?.washes_per_month} lavados
                  </span>
                  <span className="text-muted-foreground">{formatDate(sub.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Suscripción</DialogTitle>
            <DialogDescription>
              {selectedSubscription?.customer_name} - {selectedSubscription?.subscription_plans?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedSubscription && (
            <div className="space-y-6">
              {/* Customer info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{selectedSubscription.customer_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedSubscription.customer_email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedSubscription.customer_phone}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openWhatsApp(selectedSubscription.customer_phone)}
                  >
                    <MessageCircle className="w-4 h-4 text-green-600" />
                  </Button>
                </div>
              </div>

              {/* Plan & Status */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="font-medium">{selectedSubscription.subscription_plans?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Precio mensual</span>
                  <span className="font-medium">{formatPrice(selectedSubscription.subscription_plans?.price_cents || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  {getStatusBadge(selectedSubscription.status)}
                </div>
                
                {/* Credits with progress bar */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Créditos disponibles</span>
                    <span className="font-bold text-lg text-primary">
                      {selectedSubscription.washes_remaining} / {selectedSubscription.subscription_plans?.washes_per_month}
                    </span>
                  </div>
                  <Progress 
                    value={(selectedSubscription.washes_remaining / (selectedSubscription.subscription_plans?.washes_per_month || 1)) * 100} 
                    className="h-2"
                  />
                </div>
                
                {selectedSubscription.current_period_start && selectedSubscription.current_period_end && (
                  <div className="flex justify-between items-center text-sm pt-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Período
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(selectedSubscription.current_period_start)} - {formatDate(selectedSubscription.current_period_end)}
                    </span>
                  </div>
                )}
              </div>

              {/* Adjust credits */}
              <div className="bg-muted/30 rounded-lg p-4">
                <Label className="text-sm text-muted-foreground">Ajustar créditos</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreditsDelta(prev => prev - 1)}
                    disabled={isUpdating}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    value={creditsDelta}
                    onChange={(e) => setCreditsDelta(parseInt(e.target.value) || 0)}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreditsDelta(prev => prev + 1)}
                    disabled={isUpdating}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAdjustCredits(selectedSubscription.id, creditsDelta)}
                    disabled={creditsDelta === 0 || isUpdating}
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                  </Button>
                </div>
              </div>

              {/* Event History */}
              <div className="border rounded-lg">
                <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Historial</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {isLoadingEvents ? (
                    <div className="p-4 text-center">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </div>
                  ) : events.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Sin eventos registrados
                    </div>
                  ) : (
                    <div className="divide-y">
                      {events.map((event) => (
                        <div key={event.id} className="p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(event.created_at)}
                            </span>
                          </div>
                          {event.payload && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {typeof event.payload === 'object' 
                                ? JSON.stringify(event.payload).slice(0, 100)
                                : event.payload
                              }
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <DialogFooter className="flex-col sm:flex-row gap-2">
                {selectedSubscription.status === SUBSCRIPTION_STATUSES.pending && (
                  <Button
                    onClick={() => handleUpdateStatus(selectedSubscription.id, SUBSCRIPTION_STATUSES.active)}
                    disabled={isUpdating}
                    className="flex-1"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Activar
                  </Button>
                )}
                
                {selectedSubscription.status === SUBSCRIPTION_STATUSES.active && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleGenerateNewCycle(selectedSubscription)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Nuevo ciclo
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleSendPaymentEmail(selectedSubscription)}
                      disabled={isSendingPayment}
                    >
                      {isSendingPayment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Enviar pago
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedSubscription.id, SUBSCRIPTION_STATUSES.paused)}
                      disabled={isUpdating}
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pausar
                    </Button>
                  </>
                )}

                {selectedSubscription.status === SUBSCRIPTION_STATUSES.paused && (
                  <Button
                    onClick={() => handleUpdateStatus(selectedSubscription.id, SUBSCRIPTION_STATUSES.active)}
                    disabled={isUpdating}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Reactivar
                  </Button>
                )}

                {selectedSubscription.status !== SUBSCRIPTION_STATUSES.cancelled && (
                  <Button
                    variant="destructive"
                    onClick={() => handleUpdateStatus(selectedSubscription.id, SUBSCRIPTION_STATUSES.cancelled)}
                    disabled={isUpdating}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}