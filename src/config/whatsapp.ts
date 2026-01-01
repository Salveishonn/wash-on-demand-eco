/**
 * Centralized WhatsApp configuration
 * Single source of truth for the Washero WhatsApp number
 */

// WhatsApp number in E.164 format (without +) for wa.me links and API calls
export const WHATSAPP_NUMBER_E164 = "5491176247835";

// WhatsApp number formatted for display
export const WHATSAPP_NUMBER_DISPLAY = "+54 9 11 7624 7835";

// Pre-formatted wa.me URL base
export const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_NUMBER_E164}`;

/**
 * Generate a WhatsApp URL with an optional pre-filled message
 */
export function getWhatsAppUrl(message?: string): string {
  if (message) {
    return `${WHATSAPP_BASE_URL}?text=${encodeURIComponent(message)}`;
  }
  return WHATSAPP_BASE_URL;
}

/**
 * Admin WhatsApp number (same as main number)
 * Used for receiving notifications
 */
export const ADMIN_WHATSAPP_E164 = "+5491176247835";

/**
 * Admin email for notifications
 */
export const ADMIN_EMAIL = "washerocarwash@gmail.com";
