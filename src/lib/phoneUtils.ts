/**
 * Phone number utilities for Argentina E.164 normalization
 * Uses libphonenumber-style logic for Argentina
 */

/**
 * Normalize phone number to E.164 format for Argentina
 * Handles various input formats common in Argentina
 * 
 * @param phone - Input phone number in any format
 * @returns E.164 formatted phone number (e.g., +5491123456789)
 */
export function normalizePhoneE164(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + for processing
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle Argentina-specific formats
  
  // Already has full Argentina code with 9 (mobile indicator)
  if (cleaned.startsWith('549') && cleaned.length >= 12) {
    return '+' + cleaned;
  }
  
  // Has Argentina code without mobile 9
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    const rest = cleaned.substring(2);
    // Check if it's a mobile number (needs 9)
    if (rest.startsWith('11') || rest.startsWith('15') || rest.length === 10) {
      // Add mobile indicator 9
      let mobile = rest;
      if (mobile.startsWith('15')) {
        // Remove local mobile prefix and add 9
        mobile = mobile.substring(2);
      }
      return '+549' + mobile;
    }
    return '+54' + rest;
  }
  
  // Starts with 15 (local mobile prefix in Argentina)
  if (cleaned.startsWith('15') && cleaned.length >= 8) {
    // Remove 15 and add full prefix
    const number = cleaned.substring(2);
    // Assume Buenos Aires area code 11 if not specified
    return '+54911' + number;
  }
  
  // Starts with 11 (Buenos Aires area code)
  if (cleaned.startsWith('11') && cleaned.length >= 10) {
    return '+549' + cleaned;
  }
  
  // Starts with 9 (mobile indicator without country code)
  if (cleaned.startsWith('9') && cleaned.length >= 10) {
    return '+54' + cleaned;
  }
  
  // 10-digit number (area code + number)
  if (cleaned.length === 10) {
    return '+549' + cleaned;
  }
  
  // 8-digit number (Buenos Aires local without area code)
  if (cleaned.length === 8) {
    return '+54911' + cleaned;
  }
  
  // Fallback: add +54 if it looks like an Argentina number
  if (cleaned.length >= 8 && cleaned.length <= 12 && !cleaned.startsWith('54')) {
    return '+54' + cleaned;
  }
  
  // Return as-is with + if it's already formatted
  return '+' + cleaned;
}

/**
 * Format phone for Meta WhatsApp API (digits only, no +)
 */
export function normalizePhoneForMeta(phone: string): string {
  const e164 = normalizePhoneE164(phone);
  return e164.replace(/[^0-9]/g, '');
}

/**
 * Format phone for WhatsApp deep link (wa.me)
 * Uses E.164 without the + prefix
 */
export function getWhatsAppDeepLink(phone: string, message?: string): string {
  const normalized = normalizePhoneForMeta(phone);
  if (!normalized) return '';
  
  let url = `https://wa.me/${normalized}`;
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  return url;
}

/**
 * Validate if a phone number looks valid for Argentina
 */
export function isValidArgentinaPhone(phone: string): boolean {
  if (!phone) return false;
  
  const cleaned = phone.replace(/[^\d]/g, '');
  
  // Must have at least 8 digits and at most 15
  if (cleaned.length < 8 || cleaned.length > 15) return false;
  
  // If starts with 54, should have 11-13 digits total
  if (cleaned.startsWith('54')) {
    return cleaned.length >= 11 && cleaned.length <= 13;
  }
  
  // Local number should be 8-10 digits
  return cleaned.length >= 8 && cleaned.length <= 10;
}

/**
 * Format phone for display (more readable format)
 */
export function formatPhoneForDisplay(phone: string): string {
  const e164 = normalizePhoneE164(phone);
  if (!e164) return phone;
  
  // Format as +54 9 11 XXXX-XXXX for Buenos Aires mobile
  if (e164.startsWith('+54911')) {
    const local = e164.substring(6);
    if (local.length === 8) {
      return `+54 9 11 ${local.substring(0, 4)}-${local.substring(4)}`;
    }
  }
  
  // Format as +54 9 XXX XXX-XXXX for other areas
  if (e164.startsWith('+549')) {
    const rest = e164.substring(4);
    if (rest.length === 10) {
      return `+54 9 ${rest.substring(0, 3)} ${rest.substring(3, 6)}-${rest.substring(6)}`;
    }
  }
  
  return e164;
}
