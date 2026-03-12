import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, RefreshCw, MapPin, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { formatPrice } from '@/hooks/usePricing';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

interface MapBooking {
  id: string;
  customer_name: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  address: string | null;
  barrio: string | null;
  status: string;
  payment_status: string;
  latitude: number | null;
  longitude: number | null;
  discount_type: string | null;
  discount_percent: number | null;
  is_launch_founder_slot: boolean | null;
  cluster_size: number | null;
  cluster_discount_percent: number | null;
  base_price_ars: number | null;
  final_price_ars: number | null;
  total_price_ars: number | null;
  is_test: boolean;
}

const DISCOUNT_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  none: { bg: '#22c55e', border: '#16a34a', label: 'Precio completo' },
  founder: { bg: '#eab308', border: '#ca8a04', label: 'Fundador' },
  cluster: { bg: '#3b82f6', border: '#2563eb', label: 'Cluster' },
  barrio: { bg: '#a855f7', border: '#9333ea', label: 'Barrio' },
  cancelled: { bg: '#9ca3af', border: '#ef4444', label: 'Cancelada' },
};

function getBookingColor(booking: MapBooking) {
  if (booking.status === 'cancelled') return DISCOUNT_COLORS.cancelled;
  if (booking.is_launch_founder_slot) return DISCOUNT_COLORS.founder;
  if (booking.discount_type === 'cluster') return DISCOUNT_COLORS.cluster;
  if (booking.discount_type === 'barrio') return DISCOUNT_COLORS.barrio;
  return DISCOUNT_COLORS.none;
}

function getDateRange(filter: TimeFilter): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  switch (filter) {
    case 'today': {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
    }
    case 'week': {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
    }
    case 'month': {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 1);
      return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
    }
    default:
      return { from: '2020-01-01', to: '2099-12-31' };
  }
}

export function DemandMapTab() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  const [bookings, setBookings] = useState<MapBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');

  const geoBookings = bookings.filter(b => b.latitude && b.longitude && !b.is_test);

  // Stats
  const stats = {
    total: geoBookings.length,
    withDiscount: geoBookings.filter(b => b.discount_type && b.status !== 'cancelled').length,
    founder: geoBookings.filter(b => b.is_launch_founder_slot && b.status !== 'cancelled').length,
    cluster: geoBookings.filter(b => b.discount_type === 'cluster' && b.status !== 'cancelled').length,
    avgDiscount: (() => {
      const discounted = geoBookings.filter(b => (b.discount_percent ?? 0) > 0 && b.status !== 'cancelled');
      if (!discounted.length) return 0;
      return Math.round(discounted.reduce((s, b) => s + (b.discount_percent ?? 0), 0) / discounted.length);
    })(),
    topZones: (() => {
      const zones: Record<string, number> = {};
      geoBookings.filter(b => b.barrio && b.status !== 'cancelled').forEach(b => {
        zones[b.barrio!] = (zones[b.barrio!] || 0) + 1;
      });
      return Object.entries(zones).sort((a, b) => b[1] - a[1]).slice(0, 5);
    })(),
  };

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { from, to } = getDateRange(timeFilter);
      const { data, error } = await supabase
        .from('bookings')
        .select('id,customer_name,service_name,booking_date,booking_time,address,barrio,status,payment_status,latitude,longitude,discount_type,discount_percent,is_launch_founder_slot,cluster_size,cluster_discount_percent,base_price_ars,final_price_ars,total_price_ars,is_test')
        .gte('booking_date', from)
        .lte('booking_date', to)
        .order('booking_date', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error('[DemandMap] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // Load Google Maps
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('get-maps-api-key');
        if (cancelled || !data?.apiKey) {
          setMapError('No se pudo obtener la API key de Google Maps');
          return;
        }
        const result = await loadGoogleMaps(data.apiKey);
        if (cancelled) return;
        if (!result.success) {
          setMapError(result.error || 'Error cargando Google Maps');
          return;
        }
        setMapReady(true);
      } catch (e: any) {
        if (!cancelled) setMapError(e.message || 'Error cargando mapa');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Render map + markers
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;

    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    // Init map centered on Buenos Aires area
    if (!googleMapRef.current) {
      googleMapRef.current = new gmaps.Map(mapRef.current, {
        center: { lat: -34.45, lng: -58.7 },
        zoom: 11,
        mapId: 'washero-demand-map',
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
      });
      infoWindowRef.current = new gmaps.InfoWindow();
    }

    // Clear old markers
    markersRef.current.forEach(m => (m.map = null));
    markersRef.current = [];

    if (!geoBookings.length) return;

    const bounds = new gmaps.LatLngBounds();

    geoBookings.forEach(booking => {
      const pos = { lat: booking.latitude!, lng: booking.longitude! };
      bounds.extend(pos);

      const color = getBookingColor(booking);

      // Create colored pin element
      const pinEl = document.createElement('div');
      pinEl.style.cssText = `
        width: 16px; height: 16px; border-radius: 50%;
        background: ${color.bg}; border: 2.5px solid ${color.border};
        box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;
      `;

      const marker = new gmaps.marker.AdvancedMarkerElement({
        position: pos,
        map: googleMapRef.current!,
        content: pinEl,
        title: booking.customer_name,
      });

      marker.addListener('click', () => {
        const price = booking.final_price_ars ?? booking.total_price_ars ?? 0;
        const discountLabel = booking.is_launch_founder_slot
          ? '🏆 Fundador'
          : booking.discount_type === 'cluster'
          ? '📍 Cluster'
          : booking.discount_type === 'barrio'
          ? '🏘️ Barrio'
          : '—';

        infoWindowRef.current?.setContent(`
          <div style="font-family:system-ui;min-width:220px;font-size:13px;line-height:1.5">
            <strong style="font-size:14px">${booking.customer_name}</strong><br/>
            <span style="color:#666">${booking.service_name}</span><br/>
            <hr style="margin:6px 0;border-color:#eee"/>
            <b>Fecha:</b> ${booking.booking_date} ${booking.booking_time}<br/>
            <b>Zona:</b> ${booking.barrio || 'N/D'}<br/>
            <b>Estado:</b> ${booking.status}<br/>
            <b>Pago:</b> ${booking.payment_status}<br/>
            <hr style="margin:6px 0;border-color:#eee"/>
            <b>Base:</b> ${booking.base_price_ars ? formatPrice(booking.base_price_ars) : 'N/D'}<br/>
            <b>Descuento:</b> ${discountLabel} ${booking.discount_percent ? `(${booking.discount_percent}%)` : ''}<br/>
            <b>Final:</b> ${price ? formatPrice(price) : 'N/D'}<br/>
            ${booking.cluster_size ? `<b>Cluster size:</b> ${booking.cluster_size}<br/>` : ''}
          </div>
        `);
        infoWindowRef.current?.open(googleMapRef.current!, marker);
      });

      markersRef.current.push(marker);
    });

    if (geoBookings.length > 1) {
      googleMapRef.current?.fitBounds(bounds, 60);
    } else if (geoBookings.length === 1) {
      googleMapRef.current?.setCenter({ lat: geoBookings[0].latitude!, lng: geoBookings[0].longitude! });
      googleMapRef.current?.setZoom(14);
    }
  }, [mapReady, geoBookings]);

  const filterButtons: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'all', label: 'Todo' },
  ];

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            Mapa de Demanda
          </h2>
          <p className="text-sm text-muted-foreground">{geoBookings.length} reservas con ubicación</p>
        </div>
        <div className="flex items-center gap-2">
          {filterButtons.map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={timeFilter === f.key ? 'default' : 'outline'}
              onClick={() => setTimeFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={fetchBookings} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Con ubicación</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.founder}</p>
            <p className="text-xs text-muted-foreground">Fundador</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.cluster}</p>
            <p className="text-xs text-muted-foreground">Cluster</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.withDiscount}</p>
            <p className="text-xs text-muted-foreground">Con descuento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.avgDiscount}%</p>
            <p className="text-xs text-muted-foreground">Desc. promedio</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Map */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              {isLoading && (
                <div className="absolute inset-0 z-10 bg-background/60 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              {mapError ? (
                <div className="h-[500px] flex items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center space-y-2">
                    <MapPin className="w-10 h-10 mx-auto text-muted-foreground/40" />
                    <p>{mapError}</p>
                    <p className="text-xs">Las estadísticas de zona siguen disponibles abajo.</p>
                  </div>
                </div>
              ) : (
                <div ref={mapRef} className="h-[500px] w-full" />
              )}

              {/* Legend */}
              {!mapError && (
                <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg shadow-md p-3 text-xs space-y-1.5 z-10">
                  {Object.entries(DISCOUNT_COLORS).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full border-2"
                        style={{ backgroundColor: val.bg, borderColor: val.border }}
                      />
                      <span>{val.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Zones sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top Zonas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.topZones.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin datos de zona</p>
              )}
              {stats.topZones.map(([zone, count], i) => (
                <div key={zone} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
                    <span className="font-medium truncate max-w-[140px]">{zone}</span>
                  </span>
                  <span className="font-bold text-primary">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
