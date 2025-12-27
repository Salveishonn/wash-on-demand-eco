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

type MapsScriptStatus = "idle" | "loading" | "loaded" | "failed";
type PlacesStatus = "unknown" | "available" | "missing";
type AutocompleteStatus = "idle" | "attached" | "failed";

export function AddressAutocomplete({
  initialValue = "",
  onTextChange,
  onSelect,
  placeholder = "Ingresá la dirección...",
  className = "",
}: AddressAutocompleteProps) {
  // Single source of truth: local input value
  const [inputValue, setInputValue] = useState<string>("");

  // Diagnostics (visible + console)
  const [mapsScriptStatus, setMapsScriptStatus] = useState<MapsScriptStatus>("idle");
  const [placesStatus, setPlacesStatus] = useState<PlacesStatus>("unknown");
  const [autocompleteStatus, setAutocompleteStatus] = useState<AutocompleteStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const initAttemptedRef = useRef(false);
  const didInitValueRef = useRef(false);

  // Keep latest callbacks without re-initializing autocomplete
  const onSelectRef = useRef(onSelect);
  const onTextChangeRef = useRef(onTextChange);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

  // Initialize initialValue ONCE (never re-sync on every render/keystroke)
  useEffect(() => {
    if (didInitValueRef.current) return;
    didInitValueRef.current = true;
    setInputValue(typeof initialValue === "string" ? initialValue : "");
  }, []);

  // Capture Google Maps JS API error messages (RefererNotAllowedMapError, etc.)
  useEffect(() => {
    const handleWindowError = (ev: ErrorEvent) => {
      const msg = String(ev.message || "");
      if (!msg.includes("Google Maps JavaScript API error")) return;

      const cleaned = msg
        .replace("Google Maps JavaScript API error:", "")
        .trim();

      console.error("[Autocomplete] Maps JS error captured:", cleaned);
      setErrorMsg(cleaned || msg);
      setMapsScriptStatus("failed");
      setPlacesStatus("missing");
      setAutocompleteStatus("failed");
    };

    // gm_authFailure is called for auth-related failures (e.g., invalid key)
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.error("[Autocomplete] gm_authFailure called");
      setErrorMsg((prev) => prev || "gm_authFailure (posible InvalidKey/Billing/Referer)");
      setMapsScriptStatus("failed");
      setPlacesStatus("missing");
      setAutocompleteStatus("failed");
      if (typeof prevAuthFailure === "function") prevAuthFailure();
    };

    window.addEventListener("error", handleWindowError);
    return () => {
      window.removeEventListener("error", handleWindowError);
      if ((window as any).gm_authFailure === prevAuthFailure) return;
      (window as any).gm_authFailure = prevAuthFailure;
    };
  }, []);

  // Init Google Maps + Places Autocomplete ONCE per mount
  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    let cancelled = false;

    const init = async () => {
      try {
        setErrorMsg("");
        setMapsScriptStatus("loading");
        setPlacesStatus("unknown");
        setAutocompleteStatus("idle");

        console.log("[Maps] Origin", window.location.origin);
        console.log("[Maps] loaded:", !!window.google?.maps);
        console.log("[Places] available:", !!window.google?.maps?.places);

        // 1) Fetch API key from backend function
        console.log("[Autocomplete] Fetching API key...");
        const { data, error: fetchErr } = await supabase.functions.invoke("get-maps-api-key");
        if (fetchErr) throw new Error(fetchErr.message);

        const apiKey = typeof data?.apiKey === "string" ? data.apiKey : "";
        if (!apiKey) throw new Error("API key not configured (empty response)");
        if (cancelled) return;

        // 2) Load Google Maps script (singleton)
        const load = await loadGoogleMaps(apiKey);
        if (!load.success) throw new Error(load.error || "Failed to load Google Maps");
        if (cancelled) return;

        console.log("[Maps] script: loaded");
        setMapsScriptStatus("loaded");

        // 3) Only init when input exists
        if (!inputRef.current) throw new Error("Input element not available");

        // 4) Verify Places
        if (!isMapsReady()) {
          console.log("[Places] missing after load");
          setPlacesStatus("missing");
          throw new Error("Places API not available after load");
        }

        console.log("[Places] available");
        setPlacesStatus("available");

        // 5) Attach Autocomplete
        console.log("[Autocomplete] Attaching...");
        autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "ar" },
          types: ["address"],
          fields: ["formatted_address", "geometry", "place_id"],
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          if (!place) return;

          const address = place.formatted_address || "";
          const placeId = place.place_id;
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();

          if (!address) return;

          console.log("[Autocomplete] Place selected", { address, placeId, lat, lng });
          setInputValue(address);
          onSelectRef.current?.({
            address,
            placeId,
            lat,
            lng,
          });
        });

        console.log("[Autocomplete] Autocomplete: attached");
        setAutocompleteStatus("attached");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[Autocomplete] Init failed:", msg);

        setErrorMsg((prev) => prev || msg);
        setMapsScriptStatus("failed");
        setPlacesStatus("missing");
        setAutocompleteStatus("failed");
      }
    };

    init();

    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, []);

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

  const isLoading = mapsScriptStatus === "loading";
  const isReady = mapsScriptStatus === "loaded" && placesStatus === "available" && autocompleteStatus === "attached";
  const isError = mapsScriptStatus === "failed" || placesStatus === "missing" || autocompleteStatus === "failed";

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

        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {isReady && <CheckCircle2 className="w-4 h-4 text-primary" />}
          {isError && <AlertCircle className="w-4 h-4 text-destructive" />}
        </div>
      </div>

      {/* Mandatory diagnostics (visible) */}
      <p className="text-xs text-muted-foreground">
        Maps script: {mapsScriptStatus} · Places: {placesStatus} · Autocomplete: {autocompleteStatus}
      </p>

      {isError && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Google Maps no está disponible (razón: {errorMsg || "desconocida"}). Podés escribir la dirección manualmente.
          </span>
        </div>
      )}
    </div>
  );
}

