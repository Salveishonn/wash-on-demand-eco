import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PricingItem {
  id: string;
  item_type: 'service' | 'vehicle_extra' | 'extra' | 'plan';
  item_code: string;
  display_name: string;
  price_ars: number;
  metadata: {
    duration_min?: number;
    description?: string;
    icon?: string;
    washes_per_month?: number;
    included_service?: string;
    included_vehicle_size?: string;
  };
  sort_order: number;
}

export interface ActivePricing {
  versionId: string;
  services: PricingItem[];
  vehicleExtras: PricingItem[];
  extras: PricingItem[];
  plans: PricingItem[];
}

export function usePricing() {
  return useQuery({
    queryKey: ["active-pricing"],
    queryFn: async (): Promise<ActivePricing> => {
      // Get active version
      const { data: version, error: versionError } = await supabase
        .from("pricing_versions")
        .select("id")
        .eq("is_active", true)
        .single();

      if (versionError || !version) {
        throw new Error("No active pricing version found");
      }

      // Get all items for active version
      const { data: items, error: itemsError } = await supabase
        .from("pricing_items")
        .select("*")
        .eq("pricing_version_id", version.id)
        .order("sort_order");

      if (itemsError) {
        throw new Error("Failed to fetch pricing items");
      }

      const typedItems = items as PricingItem[];

      return {
        versionId: version.id,
        services: typedItems.filter(i => i.item_type === 'service'),
        vehicleExtras: typedItems.filter(i => i.item_type === 'vehicle_extra'),
        extras: typedItems.filter(i => i.item_type === 'extra'),
        plans: typedItems.filter(i => i.item_type === 'plan'),
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

// Helper functions
export function getServiceByCode(pricing: ActivePricing | undefined, code: string) {
  return pricing?.services.find(s => s.item_code === code);
}

export function getVehicleExtraByCode(pricing: ActivePricing | undefined, code: string) {
  return pricing?.vehicleExtras.find(v => v.item_code === code);
}

export function getExtraByCode(pricing: ActivePricing | undefined, code: string) {
  return pricing?.extras.find(e => e.item_code === code);
}

export function getPlanByCode(pricing: ActivePricing | undefined, code: string) {
  return pricing?.plans.find(p => p.item_code === code);
}

export function calculateBookingTotal(
  pricing: ActivePricing,
  serviceCode: string,
  vehicleSizeCode: string,
  selectedExtraCodes: string[]
): { base: number; vehicleExtra: number; extrasTotal: number; total: number } {
  const service = getServiceByCode(pricing, serviceCode);
  const vehicle = getVehicleExtraByCode(pricing, vehicleSizeCode);
  
  const base = service?.price_ars || 0;
  const vehicleExtra = vehicle?.price_ars || 0;
  const extrasTotal = selectedExtraCodes.reduce((sum, code) => {
    const extra = getExtraByCode(pricing, code);
    return sum + (extra?.price_ars || 0);
  }, 0);

  return {
    base,
    vehicleExtra,
    extrasTotal,
    total: base + vehicleExtra + extrasTotal,
  };
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
