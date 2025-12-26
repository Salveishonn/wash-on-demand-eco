import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

// Minimal Google Maps types
interface GooglePlaceResult {
  formatted_address?: string;
  place_id?: string;
  geometry?: {
    location?: {
      lat(): number;
      lng(): number;
    };
  };
}

interface GoogleAutocomplete {
  addListener(event: string, handler: () => void): void;
  getPlace(): GooglePlaceResult;
}

interface GoogleMapsPlaces {
  Autocomplete: new (input: HTMLInputElement, options: object) => GoogleAutocomplete;
}

interface GoogleMapsEvent {
  clearInstanceListeners(instance: object): void;
}

interface GoogleMaps {
  places?: GoogleMapsPlaces;
  event?: GoogleMapsEvent;
}

interface GoogleAPI {
  maps?: GoogleMaps;
}

declare global {
  interface Window {
    google?: GoogleAPI;
    __gmapsPromise?: Promise<void>;
  }
}

type PlaceSelection = {
  address: string;
  placeId?: string;
  lat?: number;
  lng?: number;
};

interface AddressAutocompleteProps {
  /** Used only on mount/remount to prefill the input. Never synced while typing. */
  initialValue?: string;
  /** Fires on manual typing (string only). */
  onTextChange?: (text: string) => void;
  /** Fires only when a Google suggestion is selected. */
  onSelect?: (selection: PlaceSelection) => void;
  placeholder?: string;
  className?: string;
}

const safeString = (v: unknown): string => (typeof v === "string" ? v : "");

const loadGoogleMapsOnce = (apiKey: string): Promise<void> => {
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__gmapsPromise) return window.__gmapsPromise;

  window.__gmapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps="true"]'
    );

    if (existing) {
      const startedAt = Date.now();
      const interval = window.setInterval(() => {
        if (window.google?.maps?.places) {
          window.clearInterval(interval);
          resolve();
        } else if (Date.now() - startedAt > 15000) {
          window.clearInterval(interval);
          reject(new Error("Timeout esperando Google Maps"));
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&language=es&region=AR`;

    script.onload = () => {
      if (window.google?.maps?.places) resolve();
      else reject(new Error("Google Maps cargó pero Places no está disponible"));
    };

    script.onerror = () => {
      reject(new Error("No se pudo cargar Google Maps"));
    };

    document.head.appendChild(script);
  });

  return window.__gmapsPromise;
};

export function AddressAutocomplete({
  initialValue,
  onTextChange,
  onSelect,
  placeholder = "Ingresá la dirección...",
  className = "",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const initializedRef = useRef(false);

  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize value ONCE on mount/remount (never sync while typing)
  useEffect(() => {
    setInputValue(safeString(initialValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch API key from edge function, then load Maps + init Places ONCE
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      // Log current origin so user can whitelist in Google Console
      console.log("[AddressAutocomplete] Current origin:", window.location.origin);

      try {
        // Fetch API key from edge function
        const { data, error: fetchErr } = await supabase.functions.invoke("get-maps-api-key");

        if (fetchErr) {
          console.error("[AddressAutocomplete] Edge function error:", fetchErr);
          throw new Error("No se pudo obtener la API key");
        }

        const apiKey = safeString(data?.apiKey);
        if (!apiKey) {
          console.error("[AddressAutocomplete] API key missing in response:", data);
          throw new Error("Google Maps API key no configurada");
        }

        if (cancelled) return;

        // Load Google Maps script
        await loadGoogleMapsOnce(apiKey);

        if (cancelled) return;

        // If already initialized (e.g., HMR), skip
        if (initializedRef.current) {
          setIsLoaded(true);
          setIsLoading(false);
          return;
        }

        if (!inputRef.current || !window.google?.maps?.places) {
          throw new Error("Google Maps no pudo inicializarse");
        }

        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            componentRestrictions: { country: "ar" },
            types: ["geocode", "address"],
            fields: ["formatted_address", "geometry", "place_id"],
          }
        );

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          const address = safeString(place?.formatted_address);
          if (!address) return;

          const lat = place?.geometry?.location?.lat();
          const lng = place?.geometry?.location?.lng();
          const placeId = safeString(place?.place_id);

          setInputValue(address);
          onSelect?.({
            address,
            placeId: placeId || undefined,
            lat,
            lng,
          });
        });

        initializedRef.current = true;
        setIsLoaded(true);
        setIsLoading(false);
      } catch (err: unknown) {
        console.error("[AddressAutocomplete] Init error:", err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar Google Maps");
        setIsLoading(false);
        setIsLoaded(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = safeString(e.target.value);
    setInputValue(text);
    onTextChange?.(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-12 h-14 text-lg ${className}`}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {isLoaded && !isLoading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-primary">
            ✓
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-3 h-3" />
          <span>{error} — podés escribir la dirección manualmente</span>
        </div>
      )}
    </div>
  );
}
