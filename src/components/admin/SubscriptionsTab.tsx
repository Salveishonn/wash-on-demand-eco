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
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

// Canonical status values (must match DB enum)
const SUBSCRIPTION_STATUSES = {
  pending: 'pending',
  active: 'active',
  paused: 'paused',
  cancelled: 'cancelled',
  payment_failed: 'payment_failed',
} as const;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  payment_failed: 'Pago fallido',
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

export function SubscriptionsTab() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'cancelled' | 'pending'>('all');
  const [creditsDelta, setCreditsDelta] = useState<number>(0);

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

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSubscriptions();
    setIsRefreshing(false);
    toast({
      title: 'Actualizado',
      description: 'Datos actualizados',
    });
  };

  // Use edge function for status update
  const handleUpdateStatus = async (subscriptionId: string, newStatus: string) => {
    setIsUpdating(true);
    try {
      console.log('[SubscriptionsTab] Updating status:', { subscriptionId, newStatus });
      
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

      // Refresh data and close dialog
      await fetchSubscriptions();
      setIsDetailOpen(false);
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

  // Use edge function for credits adjustment
  const handleAdjustCredits = async (subscriptionId: string, delta: number) => {
    if (delta === 0) return;
    
    setIsUpdating(true);
    try {
      console.log('[SubscriptionsTab] Adjusting credits:', { subscriptionId, delta });
      
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
      
      // Update selected subscription if still open
      if (selectedSubscription && selectedSubscription.id === subscriptionId) {
        setSelectedSubscription(prev => prev ? { ...prev, washes_remaining: data.new_credits } : null);
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

  // Use edge function for sending payment email
  const handleSendPaymentEmail = async (subscription: Subscription) => {
    setIsSendingPayment(true);
    try {
      console.log('[SubscriptionsTab] Sending payment email:', subscription.id);
      
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

  // Use edge function for generating new cycle
  const handleGenerateNewCycle = async (subscription: Subscription) => {
    setIsUpdating(true);
    try {
      console.log('[SubscriptionsTab] Generating new cycle:', subscription.id);
      
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

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (statusFilter === 'all') return true;
    return sub.status === statusFilter;
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-muted-foreground">Activas</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-muted-foreground">Pendientes</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-orange-600">{stats.paused}</div>
          <div className="text-sm text-muted-foreground">Pausadas</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          <div className="text-sm text-muted-foreground">Canceladas</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          {(['all', 'active', 'pending', 'paused', 'cancelled'] as const).map((filter) => (
            <Button
              key={filter}
              variant={statusFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'all' ? 'Todas' : STATUS_LABELS[filter]}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Subscriptions list */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
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
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
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
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedSubscription.customer_phone}</span>
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
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Créditos disponibles</span>
                  <span className="font-bold text-lg text-primary">
                    {selectedSubscription.washes_remaining} / {selectedSubscription.subscription_plans?.washes_per_month}
                  </span>
                </div>
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
