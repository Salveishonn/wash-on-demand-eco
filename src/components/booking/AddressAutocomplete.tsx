import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

// Google Maps types
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

interface GoogleMaps {
  places?: GoogleMapsPlaces;
  event?: {
    clearInstanceListeners(instance: object): void;
  };
}

interface GoogleAPI {
  maps?: GoogleMaps;
}

declare global {
  interface Window {
    google?: GoogleAPI;
  }
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, lat?: number, lng?: number, placeId?: string) => void;
  placeholder?: string;
  className?: string;
}

// Helper to ensure we always have a string
const safeString = (v: unknown): string => {
  if (typeof v === 'string') return v;
  return '';
};

const DEBUG = import.meta.env.DEV;

// Singleton Google Maps script loader (prevents re-inject + re-init loops)
let googleMapsScriptPromise: Promise<void> | null = null;

const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  if (window.google?.maps?.places) return Promise.resolve();

  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="true"]');
    if (existing) {
      // Script tag exists; wait until the API becomes available.
      const startedAt = Date.now();
      const interval = window.setInterval(() => {
        if (window.google?.maps?.places) {
          window.clearInterval(interval);
          resolve();
        } else if (Date.now() - startedAt > 15000) {
          window.clearInterval(interval);
          reject(new Error('Timeout esperando Google Maps'));
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.dataset.googleMaps = 'true';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=es&region=AR`;

    script.onload = () => {
      if (window.google?.maps?.places) resolve();
      else reject(new Error('Google Maps cargó pero Places no está disponible'));
    };

    script.onerror = (e) => {
      reject(new Error(`No se pudo cargar Google Maps: ${String(e)}`));
    };

    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
};

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Ingresá la dirección...',
  className = '',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);

  // Keep latest onChange without re-triggering init effects
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const autocompleteInitializedRef = useRef(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Single source of truth for input (initialized only once from prop)
  const [inputValue, setInputValue] = useState<string>(() => safeString(value));

  if (DEBUG) {
    console.log('[AddressAutocomplete render]', {
      inputValue,
      valueProp: value,
      hasGoogle: !!window.google,
      hasMaps: !!window.google?.maps,
      hasPlaces: !!window.google?.maps?.places,
      isLoading,
      isLoaded,
      error,
    });
  }

  // Fetch API key from edge function
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        console.log('[AddressAutocomplete] Fetching API key...');
        const { data, error } = await supabase.functions.invoke('get-maps-api-key');
        
        if (error) {
          console.error('[AddressAutocomplete] Error fetching API key:', error);
          setError('Error al cargar Google Maps');
          setIsLoading(false);
          return;
        }

        if (data?.apiKey) {
          console.log('[AddressAutocomplete] API key received');
          setApiKey(data.apiKey);
        } else {
          console.warn('[AddressAutocomplete] No API key in response');
          setError('Google Maps no configurado');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[AddressAutocomplete] Failed to fetch API key:', err);
        setError('Error al cargar Google Maps');
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  const initAutocompleteOnce = useCallback(() => {
    if (autocompleteInitializedRef.current) {
      if (DEBUG) console.log('[AddressAutocomplete] places init: alreadyInit=true');
      return;
    }

    if (!inputRef.current || !window.google?.maps?.places) {
      if (DEBUG) {
        console.log('[AddressAutocomplete] places init: missing deps', {
          hasInput: !!inputRef.current,
          hasGoogle: !!window.google,
          hasPlaces: !!window.google?.maps?.places,
        });
      }
      return;
    }

    try {
      console.log('[AddressAutocomplete] Initializing places autocomplete...');

      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'ar' },
        types: ['geocode', 'address'],
        fields: ['formatted_address', 'geometry', 'place_id'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (DEBUG) console.log('[AddressAutocomplete] place_changed', place);

        const address = safeString(place?.formatted_address);
        if (!address) return;

        const lat = place?.geometry?.location?.lat();
        const lng = place?.geometry?.location?.lng();
        const placeId = safeString(place?.place_id);

        setInputValue(address);
        onChangeRef.current(address, lat, lng, placeId || undefined);
      });

      autocompleteInitializedRef.current = true;
      setIsLoaded(true);
      setIsLoading(false);
      setError(null);

      console.log('[AddressAutocomplete] Places initialized OK');
    } catch (err) {
      console.error('[AddressAutocomplete] Error initializing Places:', err);
      setError('Error al inicializar autocompletado');
      setIsLoading(false);
    }
  }, []);

  // Load Google Maps script ONCE and init Places ONCE (never depends on inputValue / onChange)
  useEffect(() => {
    if (!apiKey) return;

    setIsLoading(true);

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (DEBUG) console.log('[AddressAutocomplete] script loaded', {
          hasMaps: !!window.google?.maps,
          hasPlaces: !!window.google?.maps?.places,
        });
        initAutocompleteOnce();
      })
      .catch((err) => {
        console.error('[AddressAutocomplete] Failed to load Google Maps:', err);
        setError('Error al cargar Google Maps');
        setIsLoading(false);
      });
  }, [apiKey, initAutocompleteOnce]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = safeString(e.target.value);
    if (DEBUG) console.log('[AddressAutocomplete onChange]', text);

    setInputValue(text);

    // When user types manually, pass only the address (clear any previous place data)
    onChangeRef.current(text, undefined, undefined, undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent Enter from submitting the form or causing any issues
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Keep the current typed value - do nothing else
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
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-12 h-14 text-lg ${className}`}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {isLoaded && !isLoading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-primary">✓</span>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-3 h-3" />
          <span>{error} - podés escribir la dirección manualmente</span>
        </div>
      )}
    </div>
  );
}
