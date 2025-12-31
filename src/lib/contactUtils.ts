/**
 * Utility functions for contact actions (WhatsApp, Google Maps)
 * Re-exports phone utilities for backward compatibility
 */

import { 
  normalizePhoneE164, 
  normalizePhoneForMeta, 
  getWhatsAppDeepLink, 
  isValidArgentinaPhone,
  formatPhoneForDisplay 
} from './phoneUtils';

// Re-export for backward compatibility
export { normalizePhoneE164, normalizePhoneForMeta, isValidArgentinaPhone, formatPhoneForDisplay };

/**
 * Normalize phone number to E.164 format for Argentina
 * @deprecated Use normalizePhoneE164 from phoneUtils instead
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  const e164 = normalizePhoneE164(phone);
  // Return without + for wa.me links
  return e164.replace(/^\+/, '');
}

/**
 * Generate WhatsApp deep link URL
 */
export function getWhatsAppUrl(phone: string, message?: string): string {
  return getWhatsAppDeepLink(phone, message);
}

/**
 * Generate Google Maps search URL from address
 */
export function getGoogleMapsUrl(address: string, lat?: number | null, lng?: number | null): string {
  if (lat && lng) {
    // Use coordinates for precise location
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  
  if (!address) return '';
  
  // Use address search
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
