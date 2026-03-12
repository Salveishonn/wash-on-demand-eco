import { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Percent, Users, MapPin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  FOUNDING_SLOTS_TOTAL,
  FOUNDER_DISCOUNT_PERCENT,
} from '@/config/prelaunch';

interface ClusterTier {
  id: string;
  min_nearby: number;
  max_nearby: number | null;
  discount_percent: number;
  label: string;
  emoji: string | null;
  radius_km: number;
  is_active: boolean;
  sort_order: number;
}

export function DiscountControlPanel() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Founder state (from config — these are code constants but shown for visibility)
  const [founderEnabled, setFounderEnabled] = useState(true);
  const [founderPercent, setFounderPercent] = useState(FOUNDER_DISCOUNT_PERCENT);
  const [founderSlotLimit, setFounderSlotLimit] = useState(FOUNDING_SLOTS_TOTAL);
  const [founderUsed, setFounderUsed] = useState(0);

  // Cluster tiers
  const [clusterTiers, setClusterTiers] = useState<ClusterTier[]>([]);
  const [clusterEnabled, setClusterEnabled] = useState(true);

  const [hasChanges, setHasChanges] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch cluster tiers
      const { data: tiers, error: tiersErr } = await supabase
        .from('cluster_discount_tiers')
        .select('*')
        .order('sort_order');

      if (tiersErr) throw tiersErr;
      setClusterTiers(tiers || []);
      setClusterEnabled((tiers || []).some(t => t.is_active));

      // Count founder slots used
      const { count, error: countErr } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('is_launch_founder_slot', true)
        .eq('is_test', false);

      if (!countErr) setFounderUsed(count || 0);
    } catch (err) {
      console.error('[DiscountControl] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTierChange = (id: string, field: keyof ClusterTier, value: any) => {
    setClusterTiers(prev => prev.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
    setHasChanges(true);
  };

  const handleToggleAllCluster = (enabled: boolean) => {
    setClusterEnabled(enabled);
    setClusterTiers(prev => prev.map(t => ({ ...t, is_active: enabled })));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update each tier
      for (const tier of clusterTiers) {
        const { error } = await supabase
          .from('cluster_discount_tiers')
          .update({
            discount_percent: tier.discount_percent,
            radius_km: tier.radius_km,
            is_active: tier.is_active,
            min_nearby: tier.min_nearby,
            max_nearby: tier.max_nearby,
            label: tier.label,
            emoji: tier.emoji,
          })
          .eq('id', tier.id);

        if (error) throw error;
      }

      toast({
        title: '✅ Reglas de descuento actualizadas',
        description: 'Los cambios se aplican a futuras reservas solamente.',
      });
      setHasChanges(false);
      fetchData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudieron guardar los cambios',
      });
    } finally {
      setIsSaving(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Percent className="w-5 h-5 text-primary" />
            Control de Descuentos
          </h2>
          <p className="text-sm text-muted-foreground">
            Los cambios solo afectan reservas futuras. Precios ya confirmados no cambian.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving} className="gap-2">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </Button>
      </div>

      {hasChanges && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          ⚠️ Tenés cambios sin guardar.
        </div>
      )}

      {/* Founder Discount */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                Descuento Fundador / Lanzamiento
              </CardTitle>
              <CardDescription>Slots limitados para los primeros clientes</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="founder-toggle" className="text-sm text-muted-foreground">Activo</Label>
              <Switch
                id="founder-toggle"
                checked={founderEnabled}
                onCheckedChange={(v) => { setFounderEnabled(v); setHasChanges(true); }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Descuento %</Label>
              <Input
                type="number"
                value={founderPercent}
                onChange={(e) => { setFounderPercent(parseInt(e.target.value) || 0); setHasChanges(true); }}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Límite slots</Label>
              <Input
                type="number"
                value={founderSlotLimit}
                onChange={(e) => { setFounderSlotLimit(parseInt(e.target.value) || 0); setHasChanges(true); }}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Usados</Label>
              <div className="mt-1 h-10 flex items-center">
                <span className="text-lg font-bold">{founderUsed}</span>
                <span className="text-muted-foreground ml-1">/ {founderSlotLimit}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Restantes</Label>
              <div className="mt-1 h-10 flex items-center">
                <span className={`text-lg font-bold ${founderSlotLimit - founderUsed <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {founderSlotLimit - founderUsed}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ℹ️ El descuento fundador se define en <code>src/config/prelaunch.ts</code>. 
            Para cambiar el % o límite de forma permanente, editá ese archivo. 
            Aquí se muestra el estado actual.
          </p>
        </CardContent>
      </Card>

      {/* Cluster Discount */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                Descuento por Cluster Geográfico
              </CardTitle>
              <CardDescription>Descuentos por cercanía a otras reservas el mismo día</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="cluster-toggle" className="text-sm text-muted-foreground">
                {clusterEnabled ? 'Activo' : 'Pausado'}
              </Label>
              <Switch
                id="cluster-toggle"
                checked={clusterEnabled}
                onCheckedChange={handleToggleAllCluster}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {clusterTiers.map(tier => (
            <div key={tier.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="w-8 text-center text-lg">{tier.emoji || '📍'}</div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
                <div>
                  <Label className="text-xs text-muted-foreground">Label</Label>
                  <Input
                    value={tier.label}
                    onChange={(e) => handleTierChange(tier.id, 'label', e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Min reservas</Label>
                  <Input
                    type="number"
                    value={tier.min_nearby}
                    onChange={(e) => handleTierChange(tier.id, 'min_nearby', parseInt(e.target.value) || 0)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max reservas</Label>
                  <Input
                    type="number"
                    value={tier.max_nearby ?? ''}
                    onChange={(e) => handleTierChange(tier.id, 'max_nearby', e.target.value ? parseInt(e.target.value) : null)}
                    className="mt-1 h-8 text-sm"
                    placeholder="∞"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Descuento %</Label>
                  <Input
                    type="number"
                    value={tier.discount_percent}
                    onChange={(e) => handleTierChange(tier.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Radio km</Label>
                  <Input
                    type="number"
                    value={tier.radius_km}
                    onChange={(e) => handleTierChange(tier.id, 'radius_km', parseFloat(e.target.value) || 5)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
              <Switch
                checked={tier.is_active}
                onCheckedChange={(v) => handleTierChange(tier.id, 'is_active', v)}
              />
            </div>
          ))}
          {clusterTiers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay tiers de descuento por cluster configurados.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
