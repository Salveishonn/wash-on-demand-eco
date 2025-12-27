import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps, isMapsReady } from "@/lib/googleMapsLoader";

export type PlaceSelection = {
  address: string;
  placeId?: string;
  lat?: number;
  lng?: number;
};

interface AddressAutocompleteProps {
  initialValue?: string;
  onTextChange?: (text: string) => void;
  onSelect?: (selection: PlaceSelection) => void;
  placeholder?: string;
  className?: string;
}

type LoadStatus = "idle" | "loading" | "ready" | "error";

export function AddressAutocomplete({
  initialValue = "",
  onTextChange,
  onSelect,
  placeholder = "Ingresá la dirección...",
  className = "",
}: AddressAutocompleteProps) {
  // Local input state - NEVER synced from props after mount
  const [inputValue, setInputValue] = useState<string>(initialValue);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const initAttemptedRef = useRef(false);

  // Stable callback refs to avoid re-init on prop changes
  const onSelectRef = useRef(onSelect);
  const onTextChangeRef = useRef(onTextChange);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onTextChangeRef.current = onTextChange; }, [onTextChange]);

  // Initialize Google Maps + Autocomplete ONCE on mount
  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    let cancelled = false;

    const init = async () => {
      setStatus("loading");
      setErrorMsg("");

      try {
        // 1. Fetch API key from edge function
        console.log("[Autocomplete] Fetching API key...");
        const { data, error: fetchErr } = await supabase.functions.invoke("get-maps-api-key");

        if (fetchErr) {
          throw new Error(`Edge function error: ${fetchErr.message}`);
        }

        const apiKey = typeof data?.apiKey === "string" ? data.apiKey : "";
        if (!apiKey) {
          throw new Error("API key not configured (empty response)");
        }

        if (cancelled) return;

        // 2. Load Google Maps script
        console.log("[Autocomplete] Loading Google Maps...");
        const result = await loadGoogleMaps(apiKey);

        if (!result.success) {
          throw new Error(result.error || "Failed to load Google Maps");
        }

        if (cancelled) return;

        // 3. Wait for input ref
        if (!inputRef.current) {
          throw new Error("Input element not available");
        }

        // 4. Check Places API
        if (!isMapsReady()) {
          throw new Error("Places API not available after load");
        }

        // 5. Create Autocomplete instance
        console.log("[Autocomplete] Attaching to input...");
        autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "ar" },
          types: ["geocode", "address"],
          fields: ["formatted_address", "geometry", "place_id"],
        });

        // 6. Listen for place selection
        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          if (!place) return;

          const address = place.formatted_address || "";
          if (!address) return;

          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          const placeId = place.place_id;

          console.log("[Autocomplete] Place selected:", { address, placeId, lat, lng });

          // Update local state
          setInputValue(address);

          // Notify parent
          onSelectRef.current?.({
            address,
            placeId,
            lat,
            lng,
          });
        });

        console.log("[Autocomplete] Ready!");
        setStatus("ready");

      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[Autocomplete] Init failed:", msg);
        setErrorMsg(msg);
        setStatus("error");
      }
    };

    init();

    return () => {
      cancelled = true;
      // Cleanup listeners on unmount
      if (autocompleteRef.current) {
        google.maps.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  // Handle manual typing
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onTextChangeRef.current?.(value);
  }, []);

  // Prevent Enter from submitting form (Google dropdown uses Enter)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

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
          className={`pl-12 pr-12 h-14 text-lg ${className}`}
          autoComplete="off"
        />
        
        {/* Status indicators */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {status === "loading" && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {status === "ready" && (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          )}
          {status === "error" && (
            <AlertCircle className="w-4 h-4 text-destructive" />
          )}
        </div>
      </div>

      {/* Status text for debugging */}
      {status === "loading" && (
        <p className="text-xs text-muted-foreground">
          Cargando Google Maps...
        </p>
      )}

      {status === "error" && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Google Maps no disponible ({errorMsg}). Podés escribir la dirección manualmente.
          </span>
        </div>
      )}
    </div>
  );
}
