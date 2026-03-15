import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface BookingInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  serviceCode?: string;
  vehicleSize?: string;
  pricingVersionId?: string;
  basePriceArs?: number;
  vehicleExtraArs?: number;
  extrasTotalArs?: number;
  totalPriceArs?: number;
  servicePriceCents?: number;
  carType?: string;
  carTypeExtraCents?: number;
  bookingDate: string;
  bookingTime: string;
  address: string;
  barrio?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  userId?: string;
  subscriptionId?: string;
  isSubscriptionBooking?: boolean;
  bookingType?: "single" | "subscription";
  paymentMethod?: "online" | "transfer" | "pay_later" | "subscription";
  whatsappOptIn?: boolean;
  kipperOptIn?: boolean;
  addons?: AddonItem[];
  addonsTotalCents?: number;
  bookingSource?: string;
}

export interface AddonItem {
  code: string;
  name: string;
  price_ars: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CoverageResult {
  allowed: boolean;
  reason?: string;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

export interface BookingKind {
  isSubscription: boolean;
  isTransfer: boolean;
  isPayLater: boolean;
  whatsappOptIn: boolean;
  bookingStatus: string;
  paymentStatus: string;
  requiresPayment: boolean;
  paymentMethodValue: string | null;
}

export interface BookingFinancials {
  basePriceCents: number;
  vehicleExtraCents: number;
  addonsTotalCents: number;
  totalPriceCents: number;
  pricingVersionId: string | null;
  priceMismatch: boolean;
}

// Operative zones (server-side enforcement)
const OPERATIVE_ZONES_LOWER = [
  "caba", "capital federal", "ciudad autónoma de buenos aires", "ciudad de buenos aires",
  "palermo", "belgrano", "nuñez", "colegiales", "recoleta", "retiro",
  "san telmo", "la boca", "barracas", "caballito", "flores",
  "villa crespo", "villa urquiza", "villa devoto", "chacarita", "saavedra",
  "vicente lópez", "vicente lopez", "olivos", "la lucila", "florida", "munro",
  "san isidro", "acassuso", "martínez", "martinez", "beccar", "boulogne",
  "tigre", "nordelta", "don torcuato", "general pacheco",
  "benavídez", "benavidez", "ingeniero maschwitz", "ing. maschwitz",
  "garín", "garin", "escobar", "san fernando",
];

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 && digits.length <= 13;
}

export function validateBookingInput(data: BookingInput): ValidationResult {
  const errors: string[] = [];

  if (!data.customerName?.trim()) errors.push("Nombre es requerido");
  if (!data.customerEmail?.trim()) errors.push("Email es requerido");
  if (!data.customerPhone?.trim()) errors.push("Teléfono es requerido");
  if (!data.serviceName?.trim()) errors.push("Servicio es requerido");
  if (!data.bookingDate) errors.push("Fecha es requerida");
  if (!data.bookingTime) errors.push("Horario es requerido");
  if (!data.address?.trim()) errors.push("Dirección es requerida");

  if (data.customerEmail && !isValidEmail(data.customerEmail)) {
    errors.push("Email inválido");
  }

  if (data.customerPhone && !isValidPhone(data.customerPhone)) {
    errors.push("Teléfono inválido");
  }

  return { valid: errors.length === 0, errors };
}

export function isInOperativeArea(address: string): boolean {
  if (!address) return false;
  const lower = address.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\bc\d{4}\b/.test(lower)) return true;
  return OPERATIVE_ZONES_LOWER.some((zone) => {
    const normalized = zone.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return lower.includes(normalized);
  });
}

export function validateCoverage(address: string): CoverageResult {
  if (!isInOperativeArea(address)) {
    return {
      allowed: false,
      reason: "Por ahora Washero está disponible en C.A.B.A. y Zona Norte (Vicente López a Escobar).",
    };
  }
  return { allowed: true };
}

export async function validateAvailability(
  supabase: SupabaseClient,
  bookingDate: string,
  bookingTime: string,
): Promise<AvailabilityResult> {
  const { data: overrideData } = await supabase
    .from("availability_overrides")
    .select("is_closed")
    .eq("date", bookingDate)
    .eq("is_closed", true)
    .maybeSingle();

  if (overrideData) {
    return { available: false, reason: "Esta fecha no está disponible para reservas." };
  }

  const { data: slotOverrideData } = await supabase
    .from("availability_override_slots")
    .select("is_open")
    .eq("date", bookingDate)
    .eq("time", bookingTime)
    .eq("is_open", false)
    .maybeSingle();

  if (slotOverrideData) {
    return { available: false, reason: "Este horario no está disponible." };
  }

  return { available: true };
}

export function resolveBookingKind(data: BookingInput): BookingKind {
  const isSubscription = Boolean(
    data.bookingType === "subscription" ||
      (data.isSubscriptionBooking === true && data.subscriptionId)
  );
  const isTransfer = data.paymentMethod === "transfer";
  const isPayLater = data.paymentMethod === "pay_later";
  const whatsappOptIn = Boolean(data.whatsappOptIn);

  let bookingStatus: string;
  let paymentStatus: string;
  let requiresPayment: boolean;
  let paymentMethodValue: string | null = null;

  if (isSubscription) {
    bookingStatus = "confirmed";
    paymentStatus = "approved";
    requiresPayment = false;
    paymentMethodValue = "subscription";
  } else if (isTransfer) {
    bookingStatus = "pending";
    paymentStatus = "pending";
    requiresPayment = true;
    paymentMethodValue = "transfer";
  } else {
    bookingStatus = "pending";
    paymentStatus = "pending";
    requiresPayment = false;
    paymentMethodValue = data.paymentMethod || "pay_later";
  }

  return {
    isSubscription,
    isTransfer,
    isPayLater,
    whatsappOptIn,
    bookingStatus,
    paymentStatus,
    requiresPayment,
    paymentMethodValue,
  };
}

export async function calculateBookingFinancials(
  supabase: SupabaseClient,
  data: BookingInput,
  isSubscription: boolean,
): Promise<BookingFinancials> {
  let serverBasePriceCents = 0;
  let serverVehicleExtraCents = 0;
  let serverAddonsTotalCents = 0;
  let activePricingVersionId: string | null = null;

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
          (i) => i.item_type === "service" && (i.item_code === serviceCode || i.item_code === data.serviceCode),
        );
        if (serviceItem) serverBasePriceCents = Math.round(serviceItem.price_ars * 100);

        if (data.vehicleSize || data.carType) {
          const sizeCode = (data.vehicleSize || data.carType || "").toLowerCase().replace(/\s+/g, "_");
          const sizeItem = pricingItems.find(
            (i) => i.item_type === "vehicle_extra" && i.item_code === sizeCode,
          );
          if (sizeItem) serverVehicleExtraCents = Math.round(sizeItem.price_ars * 100);
        }
      }

      if (data.addons && data.addons.length > 0) {
        for (const addon of data.addons) {
          const addonItem = pricingItems.find(
            (i) => (i.item_type === "addon" || i.item_type === "extra") && i.item_code === addon.code,
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
  const basePriceCents = isSubscription
    ? 0
    : (serverBasePriceCents > 0
      ? serverBasePriceCents
      : (data.basePriceArs ? data.basePriceArs * 100 : (data.servicePriceCents || 0)));

  const vehicleExtraCents = isSubscription
    ? 0
    : (serverVehicleExtraCents > 0
      ? serverVehicleExtraCents
      : (data.vehicleExtraArs ? data.vehicleExtraArs * 100 : (data.carTypeExtraCents || 0)));

  const addonsTotalCents = serverAddonsTotalCents > 0
    ? serverAddonsTotalCents
    : (data.addonsTotalCents ||
      (data.extrasTotalArs
        ? data.extrasTotalArs * 100
        : addonsData.reduce((sum: number, a: AddonItem) => sum + (a.price_ars ? a.price_ars * 100 : 0), 0)));

  let priceMismatch = false;
  if (!isSubscription && serverBasePriceCents > 0) {
    const serverTotalCents = basePriceCents + vehicleExtraCents + addonsTotalCents;
    const clientTotalCents = data.totalPriceArs
      ? data.totalPriceArs * 100
      : (data.servicePriceCents || 0) + (data.carTypeExtraCents || 0) + (data.addonsTotalCents || 0);
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
