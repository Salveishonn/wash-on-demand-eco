import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps, isMapsReady, getMapsError } from "@/lib/googleMapsLoader";

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

type MapsScriptStatus = "idle" | "loading" | "ready" | "error";
type PlacesStatus = "unknown" | "ready" | "missing";
type AutocompleteStatus = "idle" | "ready" | "failed";

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

      const cleaned = msg.replace("Google Maps JavaScript API error:", "").trim();

      console.error("[Autocomplete] Maps JS error captured:", cleaned);
      setErrorMsg(cleaned || msg);
      setMapsScriptStatus("error");
      setPlacesStatus("missing");
      setAutocompleteStatus("failed");
    };

    // gm_authFailure is called for auth-related failures (e.g., invalid key)
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.error("[Autocomplete] gm_authFailure called");
      setErrorMsg((prev) => prev || "gm_authFailure (posible InvalidKey/Billing/Referer)");
      setMapsScriptStatus("error");
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

    const init = async () => {
      try {
        setErrorMsg("");
        setMapsScriptStatus("loading");
        setPlacesStatus("unknown");
        setAutocompleteStatus("idle");

        console.log("[Autocomplete] Starting initialization...");
        console.log("[Autocomplete] Origin:", window.location.origin);

        // 1) Fetch API key from backend function
        console.log("[Autocomplete] Fetching API key...");
        const { data, error: fetchErr } = await supabase.functions.invoke("get-maps-api-key");
        if (fetchErr) throw new Error(`API key fetch failed: ${fetchErr.message}`);

        const apiKey = typeof data?.apiKey === "string" ? data.apiKey : "";
        if (!apiKey) throw new Error("API key not configured (empty response)");

        console.log("[Autocomplete] API key obtained, loading Maps...");

        // 2) Load Google Maps script (singleton)
        const loadResult = await loadGoogleMaps(apiKey);

        if (!loadResult.success) {
          throw new Error(loadResult.error || "Failed to load Google Maps");
        }

        console.log("[Autocomplete] Maps script: ready");
        setMapsScriptStatus("ready");

        // 3) Verify Places is available
        if (!isMapsReady()) {
          const existingError = getMapsError();
          setPlacesStatus("missing");
          throw new Error(existingError || "Places API not available after load");
        }

        console.log("[Autocomplete] Places: ready");
        setPlacesStatus("ready");

        // 4) Attach Autocomplete only when input exists
        if (!inputRef.current) {
          throw new Error("Input element not available");
        }

        console.log("[Autocomplete] Attaching Autocomplete to input...");

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

          console.log("[Autocomplete] Place selected:", { address, placeId, lat, lng });
          setInputValue(address);
          onSelectRef.current?.({
            address,
            placeId,
            lat,
            lng,
          });
        });

        console.log("[Autocomplete] Autocomplete: ready");
        setAutocompleteStatus("ready");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[Autocomplete] Init failed:", msg);

        // Check if there's a stored error from the loader
        const storedError = getMapsError();
        const finalError = storedError || msg;

        setErrorMsg(finalError);
        if (mapsScriptStatus !== "ready") setMapsScriptStatus("error");
        setPlacesStatus("missing");
        setAutocompleteStatus("failed");
      }
    };

    init();

    // Cleanup: only remove listeners, NEVER remove the script tag
    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, []);

  // Timeout check - show timeout message if still loading after 13s
  useEffect(() => {
    if (mapsScriptStatus !== "loading") return;

    const timeoutId = setTimeout(() => {
      if (mapsScriptStatus === "loading") {
        const existingError = getMapsError();
        setMapsScriptStatus("error");
        setPlacesStatus("missing");
        setAutocompleteStatus("failed");
        setErrorMsg(
          existingError ||
            "TIMEOUT: Google Maps no cargó. Revisá: API key, billing, HTTP referrers, CSP, o bloqueo de red.",
        );
      }
    }, 13000);

    return () => clearTimeout(timeoutId);
  }, [mapsScriptStatus]);

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
  const isReady = mapsScriptStatus === "ready" && placesStatus === "ready" && autocompleteStatus === "ready";
  const isError = mapsScriptStatus === "error" || placesStatus === "missing" || autocompleteStatus === "failed";

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
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Google Maps no disponible (razón: {errorMsg || "desconocida"}). Podés escribir la dirección manualmente.
          </span>
        </div>
      )}
    </div>
  );
}
