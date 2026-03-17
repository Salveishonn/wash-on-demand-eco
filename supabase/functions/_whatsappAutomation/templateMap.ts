/**
 * WhatsApp Template Automation - Event-to-Template Mapping
 * Central source of truth for which system event triggers which template.
 */

export interface TemplateMapping {
  templateName: string;
  languageCode: string;
  paramCount: number;
  description: string;
  /** Function to build template variables from event payload */
  buildVars: (ctx: TemplateContext) => string[];
}

export interface TemplateContext {
  customerName: string;
  customerPhone: string;
  bookingDate?: string;
  bookingTime?: string;
  address?: string;
  serviceName?: string;
  planName?: string;
  washesPerMonth?: number;
  paymentUrl?: string;
  bookingId?: string;
  subscriptionId?: string;
}

function firstName(name: string): string {
  return name?.split(' ')[0]?.trim() || 'Cliente';
}

function formatDateTimeAddress(date?: string, time?: string, address?: string): string {
  const parts: string[] = [];
  if (date) {
    try {
      const [y, m, d] = date.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      parts.push(`${days[dt.getDay()]} ${d}/${m}`);
    } catch {
      parts.push(date);
    }
  }
  if (time) parts.push(`${time}hs`);
  if (address) parts.push(address.split(',')[0]?.trim() || address);
  return parts.join(' · ') || 'N/D';
}

/**
 * EVENT -> TEMPLATE mapping
 * Keys are system event types, values are template configurations.
 */
export const EVENT_TEMPLATE_MAP: Record<string, TemplateMapping> = {
  // ── Booking Created (new booking → customer gets appointment confirmation) ──
  'booking_created': {
    templateName: 'appointment_confirmation_1',
    languageCode: 'es_AR',
    paramCount: 3,
    description: 'Booking confirmation: name, date+time, address',
    buildVars: (ctx) => [
      firstName(ctx.customerName),
      formatDateTimeAddress(ctx.bookingDate, ctx.bookingTime),
      ctx.address?.split(',')[0]?.trim() || 'Tu ubicación',
    ],
  },

  // ── Booking Accepted (admin confirms → customer notified) ──
  'booking_accepted': {
    templateName: 'washero_booking_confirmed_u01',
    languageCode: 'es_AR',
    paramCount: 3,
    description: 'Booking accepted by admin: name, date+time, address',
    buildVars: (ctx) => [
      firstName(ctx.customerName),
      formatDateTimeAddress(ctx.bookingDate, ctx.bookingTime),
      ctx.address?.split(',')[0]?.trim() || 'Tu ubicación',
    ],
  },

  // ── Worker En Camino ───────────────────────────────────
  'worker_en_route': {
    templateName: 'washero_on_the_way',
    languageCode: 'es_AR',
    paramCount: 2,
    description: 'On the way: name, datetime+address',
    buildVars: (ctx) => [
      firstName(ctx.customerName),
      formatDateTimeAddress(ctx.bookingDate, ctx.bookingTime, ctx.address),
    ],
  },

  // ── Worker Arrived ─────────────────────────────────────
  'worker_arrived': {
    templateName: 'washero_arrived_uc',
    languageCode: 'es_AR',
    paramCount: 1,
    description: 'Arrived: name',
    buildVars: (ctx) => [
      firstName(ctx.customerName),
    ],
  },

  // ── Subscription Approved ──────────────────────────────
  'subscription_approved': {
    templateName: 'washero_payment_info_u01',
    languageCode: 'es_AR',
    paramCount: 3,
    description: 'Subscription active: name, plan, washes',
    buildVars: (ctx) => [
      firstName(ctx.customerName),
      ctx.planName || 'Tu plan',
      String(ctx.washesPerMonth || 'tus lavados'),
    ],
  },

  // ── Payment Instructions ───────────────────────────────
  'payment_instructions': {
    templateName: 'washero_payment_i',
    languageCode: 'es_AR',
    paramCount: 2,
    description: 'Payment link: name, url',
    buildVars: (ctx) => [
      firstName(ctx.customerName),
      ctx.paymentUrl || 'https://washero.online',
    ],
  },
};

/**
 * Resolve template for a given event type.
 * Returns null if no mapping exists.
 */
export function resolveTemplate(eventType: string): TemplateMapping | null {
  return EVENT_TEMPLATE_MAP[eventType] || null;
}
