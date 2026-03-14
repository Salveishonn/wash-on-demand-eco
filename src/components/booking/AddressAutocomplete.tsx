import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps, isMapsReady, getMapsError } from "@/lib/googleMapsLoader";
import { OPERATIVE_ZONES } from "@/config/operativeZones";

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

type AutocompleteMode = "loading" | "places" | "manual";

/**
 * Curated list of common barrios for the manual dropdown fallback.
 */
const MANUAL_BARRIOS = [
  "Palermo", "Belgrano", "Recoleta", "Núñez", "Colegiales",
  "Villa Urquiza", "Caballito", "Villa Crespo", "Chacarita", "Saavedra",
  "Olivos", "Vicente López", "San Isidro", "Martínez", "Acassuso",
  "Beccar", "Boulogne", "Tigre", "Nordelta", "Don Torcuato",
  "General Pacheco", "Benavídez", "Ingeniero Maschwitz", "Garín", "Escobar",
];

export function AddressAutocomplete({
  initialValue = "",
  onTextChange,
  onSelect,
  placeholder = "Ingresá la dirección...",
  className = "",
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState<string>(initialValue || "");
  const [mode, setMode] = useState<AutocompleteMode>("loading");
  const [manualBarrio, setManualBarrio] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const initAttemptedRef = useRef(false);
  const didInitValueRef = useRef(false);

  const onSelectRef = useRef(onSelect);
  const onTextChangeRef = useRef(onTextChange);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onTextChangeRef.current = onTextChange; }, [onTextChange]);

  // Initialize initialValue ONCE
  useEffect(() => {
    if (didInitValueRef.current) return;
    didInitValueRef.current = true;
    setInputValue(typeof initialValue === "string" ? initialValue : "");
  }, []);

  // Init Google Maps + Places Autocomplete
  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    const init = async () => {
      try {
        console.log("[Autocomplete] Starting initialization...");

        // 1) Fetch API key
        const { data, error: fetchErr } = await supabase.functions.invoke("get-maps-api-key");

        if (fetchErr) {
          console.error("[Autocomplete] API key fetch failed:", fetchErr.message);
          throw new Error(`API key fetch: ${fetchErr.message}`);
        }

        const apiKey = typeof data?.apiKey === "string" ? data.apiKey : "";
        if (!apiKey) throw new Error("API key empty");

        console.log("[Autocomplete] API key obtained, loading Maps...");

        // 2) Load Google Maps
        const loadResult = await loadGoogleMaps(apiKey);
        if (!loadResult.success) throw new Error(loadResult.error || "Maps load failed");

        console.log("[Autocomplete] Maps loaded");

        // 3) Verify Places
        if (!isMapsReady()) throw new Error(getMapsError() || "Places not available");

        // 4) Attach Autocomplete
        if (!inputRef.current) throw new Error("Input ref missing");

        autocompleteRef.current = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "ar" },
          types: ["address"],
          fields: ["formatted_address", "geometry", "place_id"],
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          if (!place?.formatted_address) return;

          const address = place.formatted_address;
          const placeId = place.place_id;
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();

          console.log("[Autocomplete] Place selected:", { address, placeId, lat, lng });
          setInputValue(address);
          onSelectRef.current?.({ address, placeId, lat, lng });
        });

        setMode("places");
        console.log("[Autocomplete] Ready with Places");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[Autocomplete] Falling back to manual mode:", msg);
        setMode("manual");
      }
    };

    init();

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, []);

  // Timeout fallback
  useEffect(() => {
    if (mode !== "loading") return;
    const t = setTimeout(() => {
      if (mode === "loading") {
        console.warn("[Autocomplete] Timeout, switching to manual");
        setMode("manual");
      }
    }, 10000);
    return () => clearTimeout(t);
  }, [mode]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = String(e.target.value ?? "");
    setInputValue(next);
    onTextChangeRef.current?.(next);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleManualBarrioChange = useCallback((value: string) => {
    setManualBarrio(value);
    // Emit a selection so the parent can detect the zone
    const fullAddress = inputValue ? `${inputValue}, ${value}` : value;
    onSelectRef.current?.({ address: fullAddress });
    onTextChangeRef.current?.(fullAddress);
  }, [inputValue]);

  const isLoading = mode === "loading";
  const isManual = mode === "manual";
  const isPlaces = mode === "places";

  return (
    <div className="space-y-2">
      {/* Main address input */}
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
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {isPlaces && <CheckCircle2 className="w-4 h-4 text-primary" />}
        </div>
      </div>

      {/* Manual fallback: friendly message + barrio selector */}
      {isManual && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            No pudimos cargar las sugerencias automáticas. Escribí la dirección y seleccioná tu barrio.
          </p>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Barrio / Zona</Label>
            <select
              value={manualBarrio}
              onChange={(e) => handleManualBarrioChange(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Seleccioná tu barrio...</option>
              {MANUAL_BARRIOS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
