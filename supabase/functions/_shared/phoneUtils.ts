/**
 * Phone number utilities for Argentina E.164 normalization
 * Shared across all Edge Functions
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
  
  // Already has full Argentina code with 9 (mobile indicator)
  if (cleaned.startsWith('549') && cleaned.length >= 12) {
    return '+' + cleaned;
  }
  
  // Has Argentina code without mobile 9
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    const rest = cleaned.substring(2);
    // Check if it's a mobile number (needs 9)
    if (rest.startsWith('11') || rest.startsWith('15') || rest.length === 10) {
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
 * Meta Cloud API expects phone without + prefix
 */
export function normalizePhoneForMeta(phone: string): string {
  const e164 = normalizePhoneE164(phone);
  return e164.replace(/[^0-9]/g, '');
}

/**
 * Validate if a phone number looks valid for WhatsApp sending
 * Returns { valid: boolean, error?: string, formatted: string }
 */
export function validatePhoneForWhatsApp(phone: string): { 
  valid: boolean; 
  error?: string; 
  e164: string;
  forMeta: string;
} {
  if (!phone) {
    return { valid: false, error: 'Phone number is empty', e164: '', forMeta: '' };
  }
  
  const e164 = normalizePhoneE164(phone);
  const forMeta = normalizePhoneForMeta(phone);
  
  // Must have at least 10 digits (country code + number)
  if (forMeta.length < 10) {
    return { 
      valid: false, 
      error: `Phone too short: ${forMeta.length} digits (min 10)`, 
      e164, 
      forMeta 
    };
  }
  
  // Must have at most 15 digits (E.164 max)
  if (forMeta.length > 15) {
    return { 
      valid: false, 
      error: `Phone too long: ${forMeta.length} digits (max 15)`, 
      e164, 
      forMeta 
    };
  }
  
  // Argentina numbers should start with 54
  if (!forMeta.startsWith('54')) {
    return { 
      valid: false, 
      error: `Invalid country code: expected 54, got ${forMeta.substring(0, 2)}`, 
      e164, 
      forMeta 
    };
  }
  
  return { valid: true, e164, forMeta };
}
