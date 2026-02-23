declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Fire a Meta Pixel event safely.
 * In development, logs the event to the console.
 */
export function trackPixelEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (import.meta.env.DEV) {
    console.log(`[Meta Pixel] ${eventName}`, params ?? "");
  }
  if (window.fbq) {
    if (params) {
      window.fbq("track", eventName, params);
    } else {
      window.fbq("track", eventName);
    }
  }
}
