// Payments configuration
// MercadoPago API is DISABLED - we use email-based payment instructions instead
// Customer receives email with MP alias/link to pay manually

// PAYMENTS_ENABLED = false means no MercadoPago API calls
// All bookings go through email-based payment instructions flow
export const PAYMENTS_ENABLED = false;

// Admin notification recipients for pay-later bookings
export const ADMIN_EMAIL = 'washerocarwash@gmail.com';
export const ADMIN_WHATSAPP = '+5491130951804';
