import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Google Maps types
interface GooglePlaceResult {
  formatted_address?: string;
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
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  className?: string;
}

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

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;

    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'ar' },
        types: ['geocode', 'address'],
        fields: ['formatted_address', 'geometry'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place) {
          const address = place.formatted_address || '';
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          onChange(address, lat, lng);
        }
      });

      setIsLoaded(true);
      setIsLoading(false);
    } catch (error) {
      console.error('[AddressAutocomplete] Error initializing:', error);
      setIsLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    if (!apiKey) {
      console.warn('[AddressAutocomplete] No API key configured');
      setIsLoading(false);
      return;
    }

    // Check if Google Maps is already loaded
    if (window.google?.maps?.places) {
      initAutocomplete();
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkLoaded);
          initAutocomplete();
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkLoaded);
        setIsLoading(false);
      }, 10000);
      return;
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      initAutocomplete();
    };
    
    script.onerror = () => {
      console.error('[AddressAutocomplete] Failed to load Google Maps');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup listeners if needed
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey, initAutocomplete]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow free text input - just update the value without coordinates
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`pl-12 h-14 text-lg ${className}`}
        autoComplete="off"
      />
      {isLoading && apiKey && (
        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
