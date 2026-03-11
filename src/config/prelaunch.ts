// ============================================
// PRE-LAUNCH / LAUNCH CONFIG
// ============================================
// PRELAUNCH_MODE: when true, ALL booking/payment is blocked.
// Set to false now that we use date-gated booking.
//
// LAUNCH_DATE: first day bookings are allowed (YYYY-MM-DD).
// Calendar disables all dates before this.
// ============================================

export const PRELAUNCH_MODE = false;

export const LAUNCH_DATE = "2026-04-15";

/** Number of founding launch slots available */
export const FOUNDING_SLOTS_TOTAL = 30;

/** Discount percentages */
export const FOUNDER_DISCOUNT_PERCENT = 20;
export const BARRIO_DISCOUNT_PERCENT = 30;
export const BARRIO_THRESHOLD = 3;

/** Launch highlight days (shown specially in calendar) */
export const LAUNCH_HIGHLIGHT_DATES = ["2026-04-15", "2026-04-16", "2026-04-17"];
