// Payments configuration
// Set VITE_PAYMENTS_ENABLED=true in .env when MercadoPago is ready

export const PAYMENTS_ENABLED = import.meta.env.VITE_PAYMENTS_ENABLED === 'true';

// Admin notification recipients for pay-later bookings
export const ADMIN_EMAIL = 'washerocarwash@gmail.com';
export const ADMIN_WHATSAPP = '+5491130951804';
