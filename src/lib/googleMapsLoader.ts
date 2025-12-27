/**
 * Singleton Google Maps script loader with Places library
 * Uses window.__gmapsPromise to ensure single load across entire app
 */

declare global {
  interface Window {
    __gmapsPromise?: Promise<void>;
    __gmapsError?: string;
    __gmapsLoaded?: boolean;
  }
}

export type MapsLoadResult = {
  success: boolean;
  error?: string;
};

const LOAD_TIMEOUT_MS = 12000;
const SCRIPT_ID = "google-maps-js";

export async function loadGoogleMaps(apiKey: string): Promise<MapsLoadResult> {
  // Already loaded successfully
  if (window.__gmapsLoaded && window.google?.maps?.places) {
    console.log("[GoogleMaps] Already loaded and ready");
    return { success: true };
  }

  // Previous load failed
  if (window.__gmapsError) {
    console.log("[GoogleMaps] Previous load failed:", window.__gmapsError);
    return { success: false, error: window.__gmapsError };
  }

  // Load in progress - wait for existing promise
  if (window.__gmapsPromise) {
    console.log("[GoogleMaps] Load in progress, waiting...");
    try {
      await window.__gmapsPromise;
      if (window.google?.maps?.places) {
        window.__gmapsLoaded = true;
        return { success: true };
      }
      return { success: false, error: "Places API not available after load" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { success: false, error: msg };
    }
  }

  // Check if script already exists in DOM
  const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    console.log("[GoogleMaps] Script tag already exists, polling for API...");
    return pollForMapsReady();
  }

  console.log("[GoogleMaps] Starting fresh load...");
  console.log("[GoogleMaps] Origin:", window.location.origin);

  // Create the promise
  window.__gmapsPromise = new Promise<void>((resolve, reject) => {
    // Create script element
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&language=es&region=AR`;

    // Timeout handler
    const timeoutId = setTimeout(() => {
      if (!window.google?.maps) {
        const err = "SCRIPT_LOAD_TIMEOUT: Google Maps did not load within 12s";
        console.error("[GoogleMaps]", err);
        window.__gmapsError = err;
        reject(new Error(err));
      }
    }, LOAD_TIMEOUT_MS);

    script.onload = () => {
      clearTimeout(timeoutId);
      console.log("[GoogleMaps] Script onload fired");
      console.log("[GoogleMaps] google exists:", !!window.google);
      console.log("[GoogleMaps] google.maps exists:", !!window.google?.maps);
      console.log("[GoogleMaps] google.maps.places exists:", !!window.google?.maps?.places);

      if (window.google?.maps?.places) {
        window.__gmapsLoaded = true;
        resolve();
      } else {
        // Sometimes Places takes a moment to initialize
        let attempts = 0;
        const pollInterval = setInterval(() => {
          attempts++;
          if (window.google?.maps?.places) {
            clearInterval(pollInterval);
            window.__gmapsLoaded = true;
            console.log("[GoogleMaps] Places ready after polling");
            resolve();
          } else if (attempts > 20) {
            clearInterval(pollInterval);
            const err = "PLACES_NOT_AVAILABLE: Script loaded but Places API missing";
            window.__gmapsError = err;
            reject(new Error(err));
          }
        }, 100);
      }
    };

    script.onerror = (event) => {
      clearTimeout(timeoutId);
      console.error("[GoogleMaps] Script load error:", event);
      const err = "SCRIPT_NETWORK_ERROR: Failed to load Google Maps (check API key, billing, referrers)";
      window.__gmapsError = err;
      reject(new Error(err));
    };

    // Append to head (never remove)
    document.head.appendChild(script);
    console.log("[GoogleMaps] Script tag injected:", script.src);
  });

  try {
    await window.__gmapsPromise;
    console.log("[GoogleMaps] Load complete, Places available");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[GoogleMaps] Load failed:", msg);
    return { success: false, error: msg };
  }
}

async function pollForMapsReady(): Promise<MapsLoadResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const poll = setInterval(() => {
      if (window.google?.maps?.places) {
        clearInterval(poll);
        window.__gmapsLoaded = true;
        console.log("[GoogleMaps] API ready after polling existing script");
        resolve({ success: true });
      } else if (Date.now() - start > LOAD_TIMEOUT_MS) {
        clearInterval(poll);
        const err = "SCRIPT_LOAD_TIMEOUT: Existing script did not initialize Maps";
        window.__gmapsError = err;
        console.error("[GoogleMaps]", err);
        resolve({ success: false, error: err });
      }
    }, 100);
  });
}

export function isMapsReady(): boolean {
  return !!(window.__gmapsLoaded && window.google?.maps?.places);
}

export function getMapsError(): string | undefined {
  return window.__gmapsError;
}
