import { useState, useEffect } from 'react';
import { Save, Loader2, Plus, DollarSign, Car, Sparkles, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { usePricing, formatPrice, type PricingItem } from '@/hooks/usePricing';

interface EditableItem extends PricingItem {
  edited_price: number;
}

export function PricingTab() {
  const { toast } = useToast();
  const { data: pricing, isLoading, refetch } = usePricing();
  
  const [services, setServices] = useState<EditableItem[]>([]);
  const [vehicleExtras, setVehicleExtras] = useState<EditableItem[]>([]);
  const [extras, setExtras] = useState<EditableItem[]>([]);
  const [plans, setPlans] = useState<EditableItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize editable state from pricing data
  useEffect(() => {
    if (pricing) {
      setServices(pricing.services.map(s => ({ ...s, edited_price: s.price_ars })));
      setVehicleExtras(pricing.vehicleExtras.map(v => ({ ...v, edited_price: v.price_ars })));
      setExtras(pricing.extras.map(e => ({ ...e, edited_price: e.price_ars })));
      setPlans(pricing.plans.map(p => ({ ...p, edited_price: p.price_ars })));
      setHasChanges(false);
    }
  }, [pricing]);

  const handlePriceChange = (
    items: EditableItem[],
    setItems: React.Dispatch<React.SetStateAction<EditableItem[]>>,
    itemCode: string,
    newPrice: number
  ) => {
    setItems(items.map(item => 
      item.item_code === itemCode ? { ...item, edited_price: newPrice } : item
    ));
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    if (!pricing) return;
    
    setIsSaving(true);
    try {
      // Get current active version number
      const { data: currentVersion, error: versionError } = await supabase
        .from('pricing_versions')
        .select('version_number')
        .eq('is_active', true)
        .single();

      if (versionError) throw versionError;

      const newVersionNumber = (currentVersion?.version_number || 0) + 1;

      // Create new pricing version
      const { data: newVersion, error: createError } = await supabase
        .from('pricing_versions')
        .insert({
          version_number: newVersionNumber,
          is_active: false,
          notes: `Admin update v${newVersionNumber}`,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Prepare all items for the new version
      const allItems = [
        ...services.map(s => ({
          pricing_version_id: newVersion.id,
          item_type: 'service',
          item_code: s.item_code,
          display_name: s.display_name,
          price_ars: s.edited_price,
          metadata: s.metadata,
          sort_order: s.sort_order,
        })),
        ...vehicleExtras.map(v => ({
          pricing_version_id: newVersion.id,
          item_type: 'vehicle_extra',
          item_code: v.item_code,
          display_name: v.display_name,
          price_ars: v.edited_price,
          metadata: v.metadata,
          sort_order: v.sort_order,
        })),
        ...extras.map(e => ({
          pricing_version_id: newVersion.id,
          item_type: 'extra',
          item_code: e.item_code,
          display_name: e.display_name,
          price_ars: e.edited_price,
          metadata: e.metadata,
          sort_order: e.sort_order,
        })),
        ...plans.map(p => ({
          pricing_version_id: newVersion.id,
          item_type: 'plan',
          item_code: p.item_code,
          display_name: p.display_name,
          price_ars: p.edited_price,
          metadata: p.metadata,
          sort_order: p.sort_order,
        })),
      ];

      // Insert all items
      const { error: itemsError } = await supabase
        .from('pricing_items')
        .insert(allItems);

      if (itemsError) throw itemsError;

      // Deactivate old version and activate new one
      const { error: deactivateError } = await supabase
        .from('pricing_versions')
        .update({ is_active: false })
        .eq('id', pricing.versionId);

      if (deactivateError) throw deactivateError;

      const { error: activateError } = await supabase
        .from('pricing_versions')
        .update({ is_active: true, activated_at: new Date().toISOString() })
        .eq('id', newVersion.id);

      if (activateError) throw activateError;

      toast({
        title: '✅ Precios actualizados',
        description: `Nueva versión v${newVersionNumber} activada`,
      });

      setHasChanges(false);
      refetch();
    } catch (error: any) {
      console.error('Error saving pricing:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudieron guardar los precios',
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

  if (!pricing) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No se encontró configuración de precios activa.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Editor de Precios</h2>
          <p className="text-sm text-muted-foreground">
            Versión activa: v{pricing.versionId.substring(0, 8)}
          </p>
        </div>
        <Button 
          onClick={handleSaveAll} 
          disabled={!hasChanges || isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Guardar Cambios
        </Button>
      </div>

      {hasChanges && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          ⚠️ Tenés cambios sin guardar. Al guardar se creará una nueva versión de precios.
        </div>
      )}

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services" className="gap-2">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Servicios</span>
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-2">
            <Car className="w-4 h-4" />
            <span className="hidden sm:inline">Vehículos</span>
          </TabsTrigger>
          <TabsTrigger value="extras" className="gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Extras</span>
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Planes</span>
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Servicios Base</CardTitle>
              <CardDescription>Precios de los servicios de lavado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.map((service) => (
                <div key={service.item_code} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                  <div className="flex-1">
                    <p className="font-medium">{service.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.metadata?.duration_min} min • {service.metadata?.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={service.item_code} className="sr-only">Precio</Label>
                    <span className="text-muted-foreground">$</span>
                    <Input
                      id={service.item_code}
                      type="number"
                      value={service.edited_price}
                      onChange={(e) => handlePriceChange(services, setServices, service.item_code, parseInt(e.target.value) || 0)}
                      className="w-32 text-right"
                    />
                    {service.edited_price !== service.price_ars && (
                      <span className="text-xs text-amber-600">
                        (era {formatPrice(service.price_ars)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicles Tab */}
        <TabsContent value="vehicles" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Extras por Tamaño de Vehículo</CardTitle>
              <CardDescription>Recargos adicionales según el tipo de vehículo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {vehicleExtras.map((vehicle) => (
                <div key={vehicle.item_code} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                  <div className="flex-1">
                    <p className="font-medium">{vehicle.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Código: {vehicle.item_code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={vehicle.item_code} className="sr-only">Precio</Label>
                    <span className="text-muted-foreground">+$</span>
                    <Input
                      id={vehicle.item_code}
                      type="number"
                      value={vehicle.edited_price}
                      onChange={(e) => handlePriceChange(vehicleExtras, setVehicleExtras, vehicle.item_code, parseInt(e.target.value) || 0)}
                      className="w-32 text-right"
                    />
                    {vehicle.edited_price !== vehicle.price_ars && (
                      <span className="text-xs text-amber-600">
                        (era {formatPrice(vehicle.price_ars)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Extras Tab */}
        <TabsContent value="extras" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Extras Opcionales</CardTitle>
              <CardDescription>Servicios adicionales que los clientes pueden agregar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {extras.map((extra) => (
                <div key={extra.item_code} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                  <div className="flex-1">
                    <p className="font-medium">{extra.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {extra.metadata?.description || `Código: ${extra.item_code}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={extra.item_code} className="sr-only">Precio</Label>
                    <span className="text-muted-foreground">+$</span>
                    <Input
                      id={extra.item_code}
                      type="number"
                      value={extra.edited_price}
                      onChange={(e) => handlePriceChange(extras, setExtras, extra.item_code, parseInt(e.target.value) || 0)}
                      className="w-32 text-right"
                    />
                    {extra.edited_price !== extra.price_ars && (
                      <span className="text-xs text-amber-600">
                        (era {formatPrice(extra.price_ars)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Planes de Suscripción</CardTitle>
              <CardDescription>Precios mensuales de los planes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plans.map((plan) => (
                <div key={plan.item_code} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                  <div className="flex-1">
                    <p className="font-medium">{plan.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {plan.metadata?.washes_per_month} lavados/mes • 
                      Servicio: {plan.metadata?.included_service} • 
                      Vehículo: {plan.metadata?.included_vehicle_size}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={plan.item_code} className="sr-only">Precio</Label>
                    <span className="text-muted-foreground">$/mes</span>
                    <Input
                      id={plan.item_code}
                      type="number"
                      value={plan.edited_price}
                      onChange={(e) => handlePriceChange(plans, setPlans, plan.item_code, parseInt(e.target.value) || 0)}
                      className="w-32 text-right"
                    />
                    {plan.edited_price !== plan.price_ars && (
                      <span className="text-xs text-amber-600">
                        (era {formatPrice(plan.price_ars)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
