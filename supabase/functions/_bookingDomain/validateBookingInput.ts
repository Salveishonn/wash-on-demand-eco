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
