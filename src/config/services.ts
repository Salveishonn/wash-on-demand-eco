/**
 * SINGLE SOURCE OF TRUTH for Washero services, pricing, and plans.
 * ALL components MUST import from here - no hardcoded prices anywhere else.
 */

// =============================================================================
// BASE SERVICES
// =============================================================================
export interface Service {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  description: string;
}

export const SERVICES: Service[] = [
  {
    id: "basico",
    name: "Lavado Básico",
    priceCents: 3000000, // $30.000
    durationMinutes: 45,
    description: "Exterior + interior básico",
  },
  {
    id: "completo",
    name: "Lavado Completo",
    priceCents: 3800000, // $38.000
    durationMinutes: 60,
    description: "Exterior + interior completo",
  },
];

// =============================================================================
// VEHICLE SIZES (extra charge, NOT a service)
// =============================================================================
export interface VehicleSize {
  id: string;
  name: string;
  extraCents: number;
}

export const VEHICLE_SIZES: VehicleSize[] = [
  { id: "small", name: "Auto Chico", extraCents: 0 },
  { id: "suv", name: "SUV / Crossover", extraCents: 500000 }, // +$5.000
  { id: "pickup", name: "Pick Up / Van", extraCents: 800000 }, // +$8.000
];

// =============================================================================
// EXTRAS (optional add-ons)
// =============================================================================
export interface Extra {
  id: string;
  name: string;
  priceCents: number;
  description?: string;
}

export const EXTRAS: Extra[] = [
  { id: "encerado", name: "Encerado Rápido", priceCents: 800000 }, // $8.000
  { id: "detallado", name: "Detallado Interior Profundo", priceCents: 900000 }, // $9.000
  { id: "olores", name: "Eliminación de Olores", priceCents: 1200000 }, // $12.000
  { id: "barro", name: "Barro / Auto muy sucio", priceCents: 700000 }, // $7.000
];

// =============================================================================
// SUBSCRIPTION PLANS
// =============================================================================
export interface SubscriptionPlan {
  id: string;
  name: string;
  priceCents: number;
  washesPerMonth: number;
  includedServiceId: string; // References SERVICES[].id
  includedVehicleSizeId: string; // References VEHICLE_SIZES[].id
  features: string[];
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "Plan Básico",
    priceCents: 5500000, // $55.000
    washesPerMonth: 2,
    includedServiceId: "basico",
    includedVehicleSizeId: "small",
    features: ["2 lavados / mes", "Exterior + interior básico"],
  },
  {
    id: "confort",
    name: "Plan Confort",
    priceCents: 9500000, // $95.000
    washesPerMonth: 4,
    includedServiceId: "completo",
    includedVehicleSizeId: "small",
    features: ["4 lavados / mes (1 por semana)", "Exterior + interior completo", "Prioridad en agenda"],
    popular: true,
  },
  {
    id: "premium",
    name: "Plan Premium",
    priceCents: 12500000, // $125.000
    washesPerMonth: 8,
    includedServiceId: "completo",
    includedVehicleSizeId: "suv",
    features: ["8 lavados / mes", "Lavado completo", "SUV incluida", "Máxima prioridad"],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getServiceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function getVehicleSizeById(id: string): VehicleSize | undefined {
  return VEHICLE_SIZES.find((v) => v.id === id);
}

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

export function getPlanByName(name: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

export function getIncludedServiceForPlan(planId: string): Service | undefined {
  const plan = getPlanById(planId);
  if (!plan) return undefined;
  return getServiceById(plan.includedServiceId);
}

export function getIncludedVehicleSizeForPlan(planId: string): VehicleSize | undefined {
  const plan = getPlanById(planId);
  if (!plan) return undefined;
  return getVehicleSizeById(plan.includedVehicleSizeId);
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatPriceShort(cents: number): string {
  const value = cents / 100;
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}.000`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Calculate total for a single booking
 */
export function calculateBookingTotal(
  serviceId: string,
  vehicleSizeId: string,
  addonsCents: number = 0
): number {
  const service = getServiceById(serviceId);
  const vehicleSize = getVehicleSizeById(vehicleSizeId);
  
  const servicePrice = service?.priceCents || 0;
  const vehicleExtra = vehicleSize?.extraCents || 0;
  
  return servicePrice + vehicleExtra + addonsCents;
}

/**
 * Map plan_id from DB to our config plan
 * Handles both slug (basic, confort, premium) and DB name (Plan Básico, etc.)
 */
export function resolvePlanId(planIdOrName: string): SubscriptionPlan | undefined {
  // Try direct ID match first
  const byId = getPlanById(planIdOrName);
  if (byId) return byId;
  
  // Try name match
  const byName = getPlanByName(planIdOrName);
  if (byName) return byName;
  
  // Try partial name match
  const lowerName = planIdOrName.toLowerCase();
  if (lowerName.includes("básico") || lowerName.includes("basico") || lowerName === "basic") {
    return getPlanById("basic");
  }
  if (lowerName.includes("confort") || lowerName === "confort") {
    return getPlanById("confort");
  }
  if (lowerName.includes("premium") || lowerName === "premium") {
    return getPlanById("premium");
  }
  
  return undefined;
}
