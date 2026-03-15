import type { BookingInput } from "./validateBookingInput.ts";

export interface BookingKind {
  isSubscription: boolean;
  isTransfer: boolean;
  isPayLater: boolean;
  whatsappOptIn: boolean;
  bookingStatus: string;
  paymentStatus: string;
  requiresPayment: boolean;
  paymentMethodValue: string | null;
}

export function resolveBookingKind(data: BookingInput): BookingKind {
  const isSubscription = Boolean(
    data.bookingType === "subscription" ||
    (data.isSubscriptionBooking === true && data.subscriptionId)
  );
  const isTransfer = data.paymentMethod === "transfer";
  const isPayLater = data.paymentMethod === "pay_later";
  const whatsappOptIn = Boolean(data.whatsappOptIn);

  let bookingStatus: string;
  let paymentStatus: string;
  let requiresPayment: boolean;
  let paymentMethodValue: string | null = null;

  if (isSubscription) {
    bookingStatus = "confirmed";
    paymentStatus = "approved";
    requiresPayment = false;
    paymentMethodValue = "subscription";
  } else if (isTransfer) {
    bookingStatus = "pending";
    paymentStatus = "pending";
    requiresPayment = true;
    paymentMethodValue = "transfer";
  } else {
    bookingStatus = "pending";
    paymentStatus = "pending";
    requiresPayment = false;
    paymentMethodValue = data.paymentMethod || "pay_later";
  }

  return {
    isSubscription,
    isTransfer,
    isPayLater,
    whatsappOptIn,
    bookingStatus,
    paymentStatus,
    requiresPayment,
    paymentMethodValue,
  };
}
