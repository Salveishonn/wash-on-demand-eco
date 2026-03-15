import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { BookingInput, AddonItem } from "./validateBookingInput.ts";

export interface BookingFinancials {
  basePriceCents: number;
  vehicleExtraCents: number;
  addonsTotalCents: number;
  totalPriceCents: number;
  pricingVersionId: string | null;
  priceMismatch: boolean;
}

export async function calculateBookingFinancials(
  supabase: SupabaseClient,
  data: BookingInput,
  isSubscription: boolean
): Promise<BookingFinancials> {
  let serverBasePriceCents = 0;
  let serverVehicleExtraCents = 0;
  let serverAddonsTotalCents = 0;
  let activePricingVersionId: string | null = null;

  // Get active pricing version
  const { data: activePricingVersion } = await supabase
    .from("pricing_versions")
    .select("id")
    .eq("is_active", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activePricingVersion) {
    activePricingVersionId = activePricingVersion.id;
    const { data: pricingItems } = await supabase
      .from("pricing_items")
      .select("item_code, item_type, price_ars")
      .eq("pricing_version_id", activePricingVersion.id);

    if (pricingItems && pricingItems.length > 0) {
      if (!isSubscription) {
        const serviceCode = data.serviceCode || data.serviceName?.toLowerCase().replace(/\s+/g, "_");
        const serviceItem = pricingItems.find(
          (i) => i.item_type === "service" && (i.item_code === serviceCode || i.item_code === data.serviceCode)
        );
        if (serviceItem) serverBasePriceCents = Math.round(serviceItem.price_ars * 100);

        if (data.vehicleSize || data.carType) {
          const sizeCode = (data.vehicleSize || data.carType || "").toLowerCase().replace(/\s+/g, "_");
          const sizeItem = pricingItems.find(
            (i) => i.item_type === "vehicle_extra" && i.item_code === sizeCode
          );
          if (sizeItem) serverVehicleExtraCents = Math.round(sizeItem.price_ars * 100);
        }
      }

      // Verify addon prices (addons cost extra even for subscriptions)
      if (data.addons && data.addons.length > 0) {
        for (const addon of data.addons) {
          const addonItem = pricingItems.find(
            (i) => (i.item_type === "addon" || i.item_type === "extra") && i.item_code === addon.code
          );
          if (addonItem) {
            serverAddonsTotalCents += Math.round(addonItem.price_ars * 100);
          } else {
            serverAddonsTotalCents += Math.round((addon.price_ars || 0) * 100);
          }
        }
      }
    }
  }

  const addonsData = data.addons || [];
  const basePriceCents = isSubscription ? 0 :
    (serverBasePriceCents > 0 ? serverBasePriceCents :
      (data.basePriceArs ? data.basePriceArs * 100 : (data.servicePriceCents || 0)));

  const vehicleExtraCents = isSubscription ? 0 :
    (serverVehicleExtraCents > 0 ? serverVehicleExtraCents :
      (data.vehicleExtraArs ? data.vehicleExtraArs * 100 : (data.carTypeExtraCents || 0)));

  const addonsTotalCents = serverAddonsTotalCents > 0 ? serverAddonsTotalCents :
    (data.addonsTotalCents ||
      (data.extrasTotalArs ? data.extrasTotalArs * 100 :
        addonsData.reduce((sum: number, a: AddonItem) => sum + (a.price_ars ? a.price_ars * 100 : 0), 0)));

  // Check for price mismatch
  let priceMismatch = false;
  if (!isSubscription && serverBasePriceCents > 0) {
    const serverTotalCents = basePriceCents + vehicleExtraCents + addonsTotalCents;
    const clientTotalCents = data.totalPriceArs ? data.totalPriceArs * 100 :
      (data.servicePriceCents || 0) + (data.carTypeExtraCents || 0) + (data.addonsTotalCents || 0);
    if (Math.abs(serverTotalCents - clientTotalCents) > 100) {
      priceMismatch = true;
    }
  }

  const totalPriceCents = basePriceCents + vehicleExtraCents + addonsTotalCents;

  return {
    basePriceCents,
    vehicleExtraCents,
    addonsTotalCents,
    totalPriceCents,
    pricingVersionId: activePricingVersionId || data.pricingVersionId || null,
    priceMismatch,
  };
}
