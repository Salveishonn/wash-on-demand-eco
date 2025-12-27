/**
 * Singleton Google Maps script loader with Places library
 */

declare global {
  interface Window {
    __gmapsPromise?: Promise<void>;
    __gmapsError?: string;
  }
}

export type MapsLoadResult = {
  success: boolean;
  error?: string;
};

let loadAttempted = false;

export async function loadGoogleMaps(apiKey: string): Promise<MapsLoadResult> {
  // Already loaded successfully
  if (window.google?.maps?.places) {
    console.log("[GoogleMaps] Already loaded");
    return { success: true };
  }

  // Already failed
  if (window.__gmapsError) {
    console.log("[GoogleMaps] Previous load failed:", window.__gmapsError);
    return { success: false, error: window.__gmapsError };
  }

  // Load in progress
  if (window.__gmapsPromise) {
    console.log("[GoogleMaps] Load in progress, waiting...");
    try {
      await window.__gmapsPromise;
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { success: false, error: msg };
    }
  }

  // Prevent duplicate loads
  if (loadAttempted) {
    return { success: false, error: "Load already attempted" };
  }
  loadAttempted = true;

  console.log("[GoogleMaps] Starting load...");
  console.log("[GoogleMaps] Origin:", window.location.origin);

  window.__gmapsPromise = new Promise<void>((resolve, reject) => {
    // Check for existing script (prefer by id)
    const existing =
      document.querySelector<HTMLScriptElement>("#google-maps") ||
      document.querySelector<HTMLScriptElement>(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      );

    if (existing) {
      console.log("[GoogleMaps] Script tag exists, polling for API...");
      const start = Date.now();
      const poll = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(poll);
          console.log("[GoogleMaps] API ready after polling");
          resolve();
        } else if (Date.now() - start > 10000) {
          clearInterval(poll);
          const err = "Timeout waiting for Google Maps API";
          window.__gmapsError = err;
          reject(new Error(err));
        }
      }, 100);
      return;
    }

    // Create and inject script
    const script = document.createElement("script");
    script.id = "google-maps";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=es&region=AR`;

    script.onload = () => {
      console.log("[GoogleMaps] Script loaded");
      console.log("[GoogleMaps] google.maps:", !!window.google?.maps);
      console.log("[GoogleMaps] google.maps.places:", !!window.google?.maps?.places);

      if (window.google?.maps?.places) {
        resolve();
      } else {
        const err = "Script loaded but Places API not available";
        window.__gmapsError = err;
        reject(new Error(err));
      }
    };

    script.onerror = (event) => {
      console.error("[GoogleMaps] Script load error:", event);
      const err = "Failed to load Google Maps script (check API key restrictions)";
      window.__gmapsError = err;
      reject(new Error(err));
    };

    document.head.appendChild(script);
    console.log("[GoogleMaps] Script injected");
  });

  try {
    await window.__gmapsPromise;
    console.log("[GoogleMaps] Load complete");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[GoogleMaps] Load failed:", msg);
    return { success: false, error: msg };
  }
}

export function isMapsReady(): boolean {
  return !!(window.google?.maps?.places);
}
