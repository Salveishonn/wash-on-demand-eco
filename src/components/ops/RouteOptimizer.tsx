import { useState } from 'react';
import { Route, Navigation, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingLocation {
  id: string;
  customer_name: string;
  booking_time: string;
  address: string | null;
  barrio: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface RouteOptimizerProps {
  bookings: BookingLocation[];
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function optimizeRoute(bookings: BookingLocation[]): BookingLocation[] {
  // Nearest-neighbor heuristic considering time windows
  const withCoords = bookings.filter(b => b.latitude && b.longitude);
  const withoutCoords = bookings.filter(b => !b.latitude || !b.longitude);

  if (withCoords.length <= 1) return [...withCoords, ...withoutCoords];

  const visited: BookingLocation[] = [];
  const remaining = [...withCoords];

  // Start with earliest booking
  remaining.sort((a, b) => (a.booking_time || '').localeCompare(b.booking_time || ''));
  visited.push(remaining.shift()!);

  while (remaining.length > 0) {
    const last = visited[visited.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(last.latitude!, last.longitude!, remaining[i].latitude!, remaining[i].longitude!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    visited.push(remaining.splice(bestIdx, 1)[0]);
  }

  return [...visited, ...withoutCoords];
}

export default function RouteOptimizer({ bookings }: RouteOptimizerProps) {
  const [optimized, setOptimized] = useState<BookingLocation[] | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const activeBookings = bookings.filter(b => (b as any).status !== 'completed' && (b as any).status !== 'cancelled');

  if (activeBookings.length < 2) return null;

  const handleOptimize = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setOptimized(optimizeRoute(activeBookings));
      setIsOptimizing(false);
    }, 500);
  };

  const openFullRoute = () => {
    const stops = (optimized || activeBookings)
      .filter(b => b.address)
      .map(b => encodeURIComponent(b.address!));
    
    if (stops.length === 0) return;
    
    const dest = stops.pop();
    const waypoints = stops.join('/');
    const url = waypoints 
      ? `https://www.google.com/maps/dir/${waypoints}/${dest}`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    
    window.open(url, '_blank');
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Ruta del día</span>
        </div>
        <Button
          size="sm"
          variant={optimized ? 'outline' : 'default'}
          className="h-8 text-xs gap-1.5"
          disabled={isOptimizing}
          onClick={handleOptimize}
        >
          {isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />}
          {optimized ? 'Recalcular' : 'Optimizar Ruta'}
        </Button>
      </div>

      {optimized && (
        <>
          <ol className="space-y-2">
            {optimized.map((b, i) => (
              <li key={b.id} className="flex items-start gap-2.5">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {b.booking_time?.slice(0, 5)} — {b.customer_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {b.barrio || b.address || 'Sin dirección'}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <Button size="sm" className="w-full h-10 gap-2" onClick={openFullRoute}>
            <Navigation className="w-4 h-4" />
            Navegar ruta completa
          </Button>
        </>
      )}
    </div>
  );
}
