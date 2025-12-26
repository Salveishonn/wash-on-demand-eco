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
    googleMapsLoading?: boolean;
    googleMapsCallbacks?: (() => void)[];
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

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Ingresá la dirección...',
  className = '',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  // Local input state to prevent undefined issues
  const [localValue, setLocalValue] = useState<string>(safeString(value));

  // Sync local value with prop value (but only if it's a valid string)
  useEffect(() => {
    const safe = safeString(value);
    if (safe !== localValue) {
      setLocalValue(safe);
    }
  }, [value]);

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

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) {
      console.warn('[AddressAutocomplete] Cannot init - missing input or Google Maps');
      return;
    }

    try {
      console.log('[AddressAutocomplete] Initializing autocomplete...');
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'ar' },
        types: ['geocode', 'address'],
        fields: ['formatted_address', 'geometry', 'place_id'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        console.log('[AddressAutocomplete] Place selected:', place);
        if (place) {
          // ALWAYS use safeString to prevent undefined
          const address = safeString(place.formatted_address);
          if (address) {
            const lat = place.geometry?.location?.lat();
            const lng = place.geometry?.location?.lng();
            const placeId = place.place_id || '';
            setLocalValue(address);
            onChange(address, lat, lng, placeId);
          }
        }
      });

      setIsLoaded(true);
      setIsLoading(false);
      setError(null);
      console.log('[AddressAutocomplete] Autocomplete initialized successfully');
    } catch (err) {
      console.error('[AddressAutocomplete] Error initializing:', err);
      setError('Error al inicializar autocompletado');
      setIsLoading(false);
    }
  }, [onChange]);

  // Load Google Maps script when API key is available
  useEffect(() => {
    if (!apiKey) return;

    console.log('[AddressAutocomplete] API key available, loading script...');

    // Check if Google Maps is already loaded
    if (window.google?.maps?.places) {
      console.log('[AddressAutocomplete] Google Maps already loaded');
      initAutocomplete();
      return;
    }

    // Check if script is already loading
    if (window.googleMapsLoading) {
      console.log('[AddressAutocomplete] Script already loading, waiting...');
      if (!window.googleMapsCallbacks) {
        window.googleMapsCallbacks = [];
      }
      window.googleMapsCallbacks.push(initAutocomplete);
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('[AddressAutocomplete] Script in DOM, waiting for load...');
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkLoaded);
          initAutocomplete();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkLoaded);
        if (!window.google?.maps?.places) {
          console.error('[AddressAutocomplete] Timeout waiting for Google Maps');
          setError('Google Maps no pudo cargarse');
          setIsLoading(false);
        }
      }, 10000);
      return;
    }

    // Load Google Maps script
    window.googleMapsLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=AR`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('[AddressAutocomplete] Google Maps script loaded');
      window.googleMapsLoading = false;
      initAutocomplete();
      
      // Call any waiting callbacks
      if (window.googleMapsCallbacks) {
        window.googleMapsCallbacks.forEach(cb => cb());
        window.googleMapsCallbacks = [];
      }
    };
    
    script.onerror = (e) => {
      console.error('[AddressAutocomplete] Failed to load Google Maps script:', e);
      window.googleMapsLoading = false;
      setError('Error al cargar Google Maps');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey, initAutocomplete]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = safeString(e.target.value);
    setLocalValue(text);
    // When user types manually, pass only the address (clear any previous place data)
    onChange(text, undefined, undefined, undefined);
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
          value={localValue}
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
