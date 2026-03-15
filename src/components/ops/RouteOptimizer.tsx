import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Route, Navigation, Loader2, MapPin, Clock, Car,
  ChevronDown, ChevronUp, MessageCircle, Eye,
  AlertTriangle, Zap, Map as MapIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────
interface BookingStop {
  id: string;
  customer_name: string;
  customer_phone: string;
  booking_time: string;
  address: string | null;
  barrio: string | null;
  service_name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  is_subscription_booking?: boolean;
  notes?: string | null;
}

interface RouteOptimizerProps {
  bookings: BookingStop[];
  onRefresh?: () => void;
}

interface Cluster {
  zone: string;
  count: number;
  stops: BookingStop[];
}

interface RouteStats {
  totalKm: number;
  estimatedMinutes: number;
  clusters: Cluster[];
  isolatedStops: BookingStop[];
}

// ── Haversine distance (km) ────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Time helpers ───────────────────────────────────────────────
function timeToMinutes(t: string): number {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

// Average driving speed in Buenos Aires / suburbs (km/h)
const AVG_SPEED_KMH = 30;
// Estimated service time per wash (minutes)
const SERVICE_TIME_MIN = 45;
// Max cluster radius (km)
const CLUSTER_RADIUS_KM = 3;

// ── Time-aware nearest neighbor with feasibility ───────────────
function optimizeRoute(stops: BookingStop[]): BookingStop[] {
  const withCoords = stops.filter((b) => b.latitude && b.longitude);
  const withoutCoords = stops.filter((b) => !b.latitude || !b.longitude);

  if (withCoords.length <= 1) return [...withCoords, ...withoutCoords];

  // Sort by time first to establish baseline order
  const sorted = [...withCoords].sort(
    (a, b) => timeToMinutes(a.booking_time) - timeToMinutes(b.booking_time)
  );

  // Group into time windows (buckets of overlapping times)
  const windows: BookingStop[][] = [];
  let currentWindow: BookingStop[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = timeToMinutes(curr.booking_time) - timeToMinutes(prev.booking_time);

    // If within ~1 hour window, these can be reordered for proximity
    if (gap <= 60) {
      currentWindow.push(curr);
    } else {
      windows.push(currentWindow);
      currentWindow = [curr];
    }
  }
  windows.push(currentWindow);

  // Within each window, apply nearest-neighbor
  const result: BookingStop[] = [];

  for (const window of windows) {
    if (window.length <= 1) {
      result.push(...window);
      continue;
    }

    // If we have a previous stop, start from the closest to it
    const remaining = [...window];
    const optimizedWindow: BookingStop[] = [];

    // Pick starting point: closest to last result stop, or earliest
    if (result.length > 0) {
      const lastStop = result[result.length - 1];
      remaining.sort(
        (a, b) =>
          haversine(lastStop.latitude!, lastStop.longitude!, a.latitude!, a.longitude!) -
          haversine(lastStop.latitude!, lastStop.longitude!, b.latitude!, b.longitude!)
      );
    }

    optimizedWindow.push(remaining.shift()!);

    while (remaining.length > 0) {
      const last = optimizedWindow[optimizedWindow.length - 1];
      let bestIdx = 0;
      let bestScore = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dist = haversine(
          last.latitude!,
          last.longitude!,
          remaining[i].latitude!,
          remaining[i].longitude!
        );
        // Weight: distance + small penalty for time deviation
        const timeDiff = Math.abs(
          timeToMinutes(remaining[i].booking_time) -
            timeToMinutes(last.booking_time)
        );
        const score = dist + timeDiff * 0.05; // distance-first
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      optimizedWindow.push(remaining.splice(bestIdx, 1)[0]);
    }

    result.push(...optimizedWindow);
  }

  return [...result, ...withoutCoords];
}

// ── Cluster detection ──────────────────────────────────────────
function detectClusters(stops: BookingStop[]): Cluster[] {
  const withCoords = stops.filter((b) => b.latitude && b.longitude);
  const assigned = new Set<string>();
  const clusters: Cluster[] = [];

  for (const stop of withCoords) {
    if (assigned.has(stop.id)) continue;

    const nearby = withCoords.filter(
      (other) =>
        other.id !== stop.id &&
        !assigned.has(other.id) &&
        haversine(stop.latitude!, stop.longitude!, other.latitude!, other.longitude!) <=
          CLUSTER_RADIUS_KM
    );

    if (nearby.length > 0) {
      const clusterStops = [stop, ...nearby];
      clusterStops.forEach((s) => assigned.add(s.id));
      const zone = stop.barrio || stop.address?.split(',')[0] || 'Zona sin nombre';
      clusters.push({ zone, count: clusterStops.length, stops: clusterStops });
    }
  }

  return clusters;
}

// ── Route stats ────────────────────────────────────────────────
function computeRouteStats(
  optimizedStops: BookingStop[],
  allStops: BookingStop[]
): RouteStats {
  let totalKm = 0;
  const withCoords = optimizedStops.filter((b) => b.latitude && b.longitude);

  for (let i = 1; i < withCoords.length; i++) {
    totalKm += haversine(
      withCoords[i - 1].latitude!,
      withCoords[i - 1].longitude!,
      withCoords[i].latitude!,
      withCoords[i].longitude!
    );
  }

  const drivingMin = (totalKm / AVG_SPEED_KMH) * 60;
  const serviceMin = allStops.length * SERVICE_TIME_MIN;
  const estimatedMinutes = Math.round(drivingMin + serviceMin);

  const clusters = detectClusters(allStops);
  const clusteredIds = new Set(clusters.flatMap((c) => c.stops.map((s) => s.id)));
  const isolatedStops = allStops.filter(
    (s) => s.latitude && s.longitude && !clusteredIds.has(s.id)
  );

  return { totalKm: Math.round(totalKm * 10) / 10, estimatedMinutes, clusters, isolatedStops };
}

// ── Component ──────────────────────────────────────────────────
export default function RouteOptimizer({ bookings, onRefresh }: RouteOptimizerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== 'completed' && b.status !== 'cancelled'),
    [bookings]
  );

  const optimizedRoute = useMemo(() => optimizeRoute(activeBookings), [activeBookings]);
  const stats = useMemo(
    () => computeRouteStats(optimizedRoute, activeBookings),
    [optimizedRoute, activeBookings]
  );

  const busiestCluster = useMemo(
    () => (stats.clusters.length > 0 ? stats.clusters.sort((a, b) => b.count - a.count)[0] : null),
    [stats.clusters]
  );

  // ── Map rendering ──────────────────────────────────────────
  const renderMap = useCallback(async () => {
    if (!mapContainerRef.current) return;
    const stopsWithCoords = optimizedRoute.filter((b) => b.latitude && b.longitude);
    if (stopsWithCoords.length === 0) return;

    // Fetch API key
    let apiKey = '';
    try {
      const { data } = await supabase.functions.invoke('get-maps-api-key');
      apiKey = data?.apiKey || '';
    } catch {
      return;
    }
    if (!apiKey) return;

    const loadResult = await loadGoogleMaps(apiKey);
    if (!loadResult.success || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();
    stopsWithCoords.forEach((s) => bounds.extend({ lat: s.latitude!, lng: s.longitude! }));

    const map = new google.maps.Map(mapContainerRef.current, {
      center: bounds.getCenter(),
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9a' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
      ],
    });
    map.fitBounds(bounds, 40);
    mapInstanceRef.current = map;

    // Draw route line
    if (stopsWithCoords.length > 1) {
      new google.maps.Polyline({
        path: stopsWithCoords.map((s) => ({ lat: s.latitude!, lng: s.longitude! })),
        geodesic: true,
        strokeColor: '#22c55e',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map,
      });
    }

    // Add numbered markers
    stopsWithCoords.forEach((stop, i) => {
      const svgIcon = {
        url: `data:image/svg+xml,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
            <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${i === 0 ? '#22c55e' : '#3b82f6'}"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">${i + 1}</text>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(32, 40),
        anchor: new google.maps.Point(16, 40),
      };

      const marker = new google.maps.Marker({
        position: { lat: stop.latitude!, lng: stop.longitude! },
        map,
        icon: svgIcon,
        title: `${i + 1}. ${stop.customer_name}`,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="color:#000;font-size:13px;padding:4px"><strong>${i + 1}. ${stop.booking_time?.slice(0, 5)}</strong><br/>${stop.customer_name}<br/><span style="color:#666">${stop.barrio || ''}</span></div>`,
      });
      marker.addListener('click', () => infoWindow.open(map, marker));
    });
  }, [optimizedRoute]);

  useEffect(() => {
    if (showMap) {
      renderMap();
    }
  }, [showMap, renderMap]);

  // ── Actions ────────────────────────────────────────────────
  const openMaps = (address: string) => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      '_blank'
    );
  };

  const openFullRoute = () => {
    const stops = optimizedRoute
      .filter((b) => b.address)
      .map((b) => encodeURIComponent(b.address!));
    if (stops.length === 0) return;
    const dest = stops.pop();
    const waypoints = stops.join('/');
    const url = waypoints
      ? `https://www.google.com/maps/dir/${waypoints}/${dest}`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    window.open(url, '_blank');
  };

  const sendQuickWhatsApp = (phone: string, name: string) => {
    const clean = (phone || '').replace(/\D/g, '');
    const full = clean.startsWith('54') ? clean : `54${clean}`;
    window.open(
      `https://wa.me/${full}?text=${encodeURIComponent(`Hola ${name.split(' ')[0]}, soy de Washero 🚗`)}`,
      '_blank'
    );
  };

  if (activeBookings.length < 2) return null;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Ruta optimizada</span>
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
            {activeBookings.length} paradas
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Summary bar — always visible */}
      <div className="px-4 pb-3 flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Navigation className="w-3 h-3" />
          <span>{stats.totalKm} km</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>~{Math.round(stats.estimatedMinutes / 60)}h {stats.estimatedMinutes % 60}min</span>
        </div>
        {busiestCluster && (
          <div className="flex items-center gap-1 text-xs text-primary">
            <Zap className="w-3 h-3" />
            <span>{busiestCluster.count} en {busiestCluster.zone}</span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-border">
          {/* Cluster insights */}
          {stats.clusters.length > 0 && (
            <div className="px-4 py-3 space-y-1.5 bg-primary/5 border-b border-border">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Zonas agrupadas
              </p>
              {stats.clusters.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                  <MapPin className="w-3 h-3 text-primary shrink-0" />
                  <span>
                    <strong>{c.count} lavados</strong> en {c.zone}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Isolated warnings */}
          {stats.isolatedStops.length > 0 && (
            <div className="px-4 py-2 bg-yellow-500/5 border-b border-border">
              {stats.isolatedStops.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-yellow-700">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>
                    Lavado aislado: {s.barrio || s.address?.split(',')[0] || s.customer_name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Optimized stop list */}
          <ol className="divide-y divide-border">
            {optimizedRoute.map((stop, i) => (
              <li key={stop.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {stop.booking_time?.slice(0, 5)}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {stop.customer_name}
                      </span>
                      {stop.is_subscription_booking && (
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-primary/10 text-primary border-primary/30 shrink-0"
                        >
                          Plan
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {stop.service_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {stop.barrio || stop.address || 'Sin dirección'}
                    </p>
                    {stop.notes && (
                      <p className="text-xs text-yellow-600 italic mt-0.5 truncate">
                        📝 {stop.notes}
                      </p>
                    )}

                    {/* Per-stop quick actions */}
                    <div className="flex gap-1.5 mt-2">
                      {stop.address && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2 gap-1"
                          onClick={() => openMaps(stop.address!)}
                        >
                          <Navigation className="w-3 h-3" />
                          Navegar
                        </Button>
                      )}
                      {stop.customer_phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2 gap-1"
                          onClick={() => sendQuickWhatsApp(stop.customer_phone, stop.customer_name)}
                        >
                          <MessageCircle className="w-3 h-3" />
                          Chat
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Distance to next */}
                  {i < optimizedRoute.length - 1 && stop.latitude && stop.longitude && optimizedRoute[i + 1]?.latitude && optimizedRoute[i + 1]?.longitude && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round(
                          haversine(
                            stop.latitude!,
                            stop.longitude!,
                            optimizedRoute[i + 1].latitude!,
                            optimizedRoute[i + 1].longitude!
                          ) * 10
                        ) / 10}{' '}
                        km
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        ~{Math.max(
                          1,
                          Math.round(
                            (haversine(
                              stop.latitude!,
                              stop.longitude!,
                              optimizedRoute[i + 1].latitude!,
                              optimizedRoute[i + 1].longitude!
                            ) /
                              AVG_SPEED_KMH) *
                              60
                          )
                        )}{' '}
                        min
                      </p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Map toggle */}
          <div className="px-4 py-3 border-t border-border space-y-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-9 text-xs gap-2"
              onClick={() => setShowMap(!showMap)}
            >
              <MapIcon className="w-3.5 h-3.5" />
              {showMap ? 'Ocultar mapa' : 'Ver mapa de ruta'}
            </Button>

            {showMap && (
              <div
                ref={mapContainerRef}
                className="w-full h-[280px] rounded-lg overflow-hidden border border-border"
              />
            )}

            <Button size="sm" className="w-full h-10 gap-2" onClick={openFullRoute}>
              <Navigation className="w-4 h-4" />
              Navegar ruta completa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
