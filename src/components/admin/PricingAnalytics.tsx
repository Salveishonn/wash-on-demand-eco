import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, Users, Tag, Rocket } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface PricingStats {
  totalBookings: number;
  founderSlotsUsed: number;
  founderSlotsMax: number;
  bookingsWithClusterDiscount: number;
  bookingsWithFounderDiscount: number;
  bookingsWithBarrioDiscount: number;
  bookingsWithoutDiscount: number;
  avgClusterSize: number;
  avgDiscountPercent: number;
}

export function PricingAnalytics() {
  const [stats, setStats] = useState<PricingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('discount_type, discount_percent, is_launch_founder_slot, cluster_size, is_test')
        .eq('is_test', false);

      if (error) throw error;

      const all = bookings || [];
      const founderSlots = all.filter(b => b.is_launch_founder_slot === true);
      const clusterDiscount = all.filter(b => b.discount_type === 'cluster');
      const founderDiscount = all.filter(b => b.discount_type === 'founder' || b.discount_type === 'launch');
      const barrioDiscount = all.filter(b => b.discount_type === 'barrio');
      const noDiscount = all.filter(b => !b.discount_type);
      const withCluster = all.filter(b => b.cluster_size != null && (b.cluster_size as number) > 0);
      const avgCluster = withCluster.length > 0
        ? withCluster.reduce((s, b) => s + ((b.cluster_size as number) || 0), 0) / withCluster.length
        : 0;
      const withDiscount = all.filter(b => b.discount_percent != null && (b.discount_percent as number) > 0);
      const avgDiscount = withDiscount.length > 0
        ? withDiscount.reduce((s, b) => s + ((b.discount_percent as number) || 0), 0) / withDiscount.length
        : 0;

      setStats({
        totalBookings: all.length,
        founderSlotsUsed: founderSlots.length,
        founderSlotsMax: 30,
        bookingsWithClusterDiscount: clusterDiscount.length,
        bookingsWithFounderDiscount: founderDiscount.length,
        bookingsWithBarrioDiscount: barrioDiscount.length,
        bookingsWithoutDiscount: noDiscount.length,
        avgClusterSize: Math.round(avgCluster * 10) / 10,
        avgDiscountPercent: Math.round(avgDiscount * 10) / 10,
      });
    } catch (err) {
      console.error('[PricingAnalytics] Error:', err);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No se pudieron cargar las estadísticas de pricing.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Estadísticas de Pricing
        </CardTitle>
        <CardDescription>Resumen de descuentos aplicados en reservas reales</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Founder slots */}
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-1.5 mb-1">
              <Rocket className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">Founder Slots</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">
              {stats.founderSlotsUsed} / {stats.founderSlotsMax}
            </p>
            <p className="text-xs text-amber-600">
              {stats.founderSlotsMax - stats.founderSlotsUsed} disponibles
            </p>
          </div>

          {/* Cluster discounts */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Desc. Cluster</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{stats.bookingsWithClusterDiscount}</p>
            <p className="text-xs text-blue-600">
              Prom. cluster: {stats.avgClusterSize || '—'}
            </p>
          </div>

          {/* Barrio discounts */}
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-1.5 mb-1">
              <Tag className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Desc. Barrio</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{stats.bookingsWithBarrioDiscount}</p>
          </div>

          {/* No discount */}
          <div className="p-3 rounded-lg bg-muted border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-muted-foreground">Sin descuento</span>
            </div>
            <p className="text-2xl font-bold">{stats.bookingsWithoutDiscount}</p>
            <p className="text-xs text-muted-foreground">
              Prom. desc.: {stats.avgDiscountPercent}%
            </p>
          </div>
        </div>

        {/* Founder + launch breakdown */}
        {stats.bookingsWithFounderDiscount > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            🚀 {stats.bookingsWithFounderDiscount} reservas con descuento de lanzamiento/founder
          </div>
        )}
      </CardContent>
    </Card>
  );
}
