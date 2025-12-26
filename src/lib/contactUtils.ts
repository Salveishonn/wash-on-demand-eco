/**
 * Utility functions for contact actions (WhatsApp, Google Maps)
 */

/**
 * Normalize phone number to E.164 format for Argentina
 * Removes spaces, dashes, parentheses and ensures +54 country code
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\\d+]/g, '');
  
  // Remove leading + for processing
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }
  
  // If starts with 54 (Argentina country code), keep it
  // If starts with 9, it's likely a mobile number without country code
  // If starts with 11 or other area codes, add 549 for mobile
  if (cleaned.startsWith('54')) {
    // Already has country code
    return cleaned;
  } else if (cleaned.startsWith('9')) {
    // Has mobile indicator but no country code
    return '54' + cleaned;
  } else {
    // Assume Argentina mobile, add 549
    return '549' + cleaned;
  }
}

/**
 * Generate WhatsApp deep link URL
 */
export function getWhatsAppUrl(phone: string): string {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}`;
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
