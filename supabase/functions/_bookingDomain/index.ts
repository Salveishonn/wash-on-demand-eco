// Booking domain layer — single source of truth for all booking logic
export { validateBookingInput, isValidEmail, isValidPhone } from "./validateBookingInput.ts";
export type { BookingInput, AddonItem, ValidationResult } from "./validateBookingInput.ts";

export { validateCoverage, validateLaunchDate, isInOperativeArea } from "./validateCoverageAndLaunchRules.ts";
export type { CoverageResult } from "./validateCoverageAndLaunchRules.ts";

export { validateAvailability } from "./validateAvailability.ts";
export type { AvailabilityResult } from "./validateAvailability.ts";

export { resolveBookingKind } from "./resolveBookingKind.ts";
export type { BookingKind } from "./resolveBookingKind.ts";

export { calculateBookingFinancials } from "./calculateBookingFinancials.ts";
export type { BookingFinancials } from "./calculateBookingFinancials.ts";
