import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface BookingDebugData {
  total_price_ars?: number | null;
  final_price_ars?: number | null;
  base_price_ars?: number | null;
  vehicle_extra_ars?: number | null;
  extras_total_ars?: number | null;
  discount_type?: string | null;
  discount_percent?: number | null;
  discount_amount_ars?: number | null;
  is_launch_founder_slot?: boolean | null;
  cluster_size?: number | null;
  cluster_discount_percent?: number | null;
  barrio?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pricing_version_id?: string | null;
  vehicle_size?: string | null;
  service_code?: string | null;
}

function getDiscountExplanation(b: BookingDebugData): string {
  if (!b.discount_type) return 'Sin descuento aplicado. Precio completo.';
  if (b.discount_type === 'founder' || b.discount_type === 'launch') {
    return `Descuento Founder/Lanzamiento aplicado (-${b.discount_percent ?? '?'}%) porque esta reserva fue una de las primeras 30 válidas post-lanzamiento.`;
  }
  if (b.discount_type === 'cluster' || b.discount_type === 'barrio') {
    const count = b.cluster_size ?? '?';
    return `Descuento por zona aplicado (-${b.discount_percent ?? '?'}%) porque se encontraron ${count} reservas cercanas en la misma fecha.`;
  }
  return `Descuento "${b.discount_type}" aplicado (-${b.discount_percent ?? '?'}%).`;
}

function safeArs(v: number | null | undefined): string {
  if (v == null) return 'N/D';
  return `$${v.toLocaleString('es-AR')}`;
}

export function BookingPricingDebug({ booking }: { booking: BookingDebugData }) {
  const [open, setOpen] = useState(false);

  const hasAnyData = booking.discount_type || booking.base_price_ars != null ||
    booking.cluster_size != null || booking.is_launch_founder_slot != null;

  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-amber-800 hover:bg-amber-50 transition-colors rounded-lg"
      >
        <span>🔍 Debug de Precio</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {!hasAnyData ? (
            <p className="text-xs text-muted-foreground italic">Sin datos de pricing disponibles para esta reserva.</p>
          ) : (
            <>
              {/* Price breakdown */}
              <div className="space-y-1.5 text-xs">
                <h5 className="font-semibold text-amber-900">Desglose</h5>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Precio base</span>
                  <span className="text-right">{safeArs(booking.base_price_ars)}</span>
                  <span className="text-muted-foreground">Extra vehículo</span>
                  <span className="text-right">{safeArs(booking.vehicle_extra_ars)}</span>
                  <span className="text-muted-foreground">Extras</span>
                  <span className="text-right">{safeArs(booking.extras_total_ars)}</span>
                  <span className="text-muted-foreground">Total sin desc.</span>
                  <span className="text-right font-medium">{safeArs(booking.total_price_ars)}</span>
                  {booking.discount_amount_ars != null && (
                    <>
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="text-right text-green-700">-{safeArs(booking.discount_amount_ars)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground font-semibold">Precio final</span>
                  <span className="text-right font-bold text-primary">{safeArs(booking.final_price_ars)}</span>
                </div>
              </div>

              {/* Discount info */}
              <div className="space-y-1.5 text-xs">
                <h5 className="font-semibold text-amber-900">Descuento</h5>
                <div className="flex flex-wrap gap-1.5">
                  {booking.discount_type ? (
                    <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-800">
                      {booking.discount_type} {booking.discount_percent != null ? `-${booking.discount_percent}%` : ''}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">Ninguno</span>
                  )}
                  {booking.is_launch_founder_slot && (
                    <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300 text-yellow-800">
                      🚀 Founder
                    </Badge>
                  )}
                </div>
              </div>

              {/* Cluster info */}
              <div className="space-y-1.5 text-xs">
                <h5 className="font-semibold text-amber-900">Cluster / Zona</h5>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Cluster size</span>
                  <span className="text-right">{booking.cluster_size ?? 'N/D'}</span>
                  <span className="text-muted-foreground">Cluster desc. %</span>
                  <span className="text-right">{booking.cluster_discount_percent != null ? `${booking.cluster_discount_percent}%` : 'N/D'}</span>
                  <span className="text-muted-foreground">Barrio</span>
                  <span className="text-right">{booking.barrio || 'N/D'}</span>
                  <span className="text-muted-foreground">Coords</span>
                  <span className="text-right font-mono">
                    {booking.latitude != null && booking.longitude != null
                      ? `${booking.latitude.toFixed(4)}, ${booking.longitude.toFixed(4)}`
                      : 'N/D'}
                  </span>
                </div>
              </div>

              {/* Meta */}
              <div className="space-y-1.5 text-xs">
                <h5 className="font-semibold text-amber-900">Metadatos</h5>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Servicio code</span>
                  <span className="text-right font-mono">{booking.service_code || 'N/D'}</span>
                  <span className="text-muted-foreground">Vehicle size</span>
                  <span className="text-right">{booking.vehicle_size || 'N/D'}</span>
                  <span className="text-muted-foreground">Pricing version</span>
                  <span className="text-right font-mono">{booking.pricing_version_id?.substring(0, 8) || 'N/D'}</span>
                </div>
              </div>

              {/* Human explanation */}
              <div className="p-2 rounded bg-amber-100/60 text-xs text-amber-900">
                💡 {getDiscountExplanation(booking)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
