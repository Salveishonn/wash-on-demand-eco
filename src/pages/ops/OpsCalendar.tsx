import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CalBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  service_name: string;
  address: string | null;
  barrio: string | null;
  status: string;
  payment_status: string;
}

export default function OpsCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<CalBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('id, booking_date, booking_time, customer_name, service_name, address, barrio, status, payment_status')
          .eq('booking_date', dateStr)
          .eq('is_test', false)
          .neq('status', 'cancelled')
          .order('booking_time', { ascending: true });

        if (error) console.warn('[OpsCalendar] Error:', error);
        setBookings((data || []) as CalBooking[]);
      } catch (err) {
        console.warn('[OpsCalendar] Unexpected error:', err);
        setBookings([]);
      }
      setIsLoading(false);
    };
    load();
  }, [dateStr]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(subDays(selectedDate, 3), i));

  return (
    <div className="px-4 py-4 space-y-4">
      <h2 className="text-lg font-display font-bold text-foreground">Agenda</h2>

      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex gap-1.5 flex-1 justify-center overflow-hidden">
          {days.map(d => {
            const isSelected = format(d, 'yyyy-MM-dd') === dateStr;
            const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "flex flex-col items-center px-2.5 py-1.5 rounded-xl transition-colors min-w-[40px]",
                  isSelected ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  isToday && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                <span className="text-[10px] font-medium uppercase">{format(d, 'EEE', { locale: es })}</span>
                <span className="text-sm font-bold">{format(d, 'd')}</span>
              </button>
            );
          })}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-sm font-medium text-muted-foreground capitalize">
        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium">Sin lavados este día</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map(b => (
            <div key={b.id} className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3">
              <div className="min-w-[44px] text-center">
                <span className="text-sm font-bold font-display text-foreground">{(b.booking_time || '').slice(0, 5)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{b.customer_name}</p>
                <p className="text-xs text-muted-foreground">{b.service_name}</p>
                {b.barrio && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{b.barrio}
                  </p>
                )}
              </div>
              <Badge 
                variant="outline" 
                className={cn("text-[10px] shrink-0",
                  b.status === 'completed' ? 'bg-accent/20 text-accent border-accent/30' :
                  b.status === 'confirmed' ? 'bg-primary/20 text-primary border-primary/30' :
                  'bg-yellow-500/20 text-yellow-700 border-yellow-300'
                )}
              >
                {b.status === 'completed' ? '✓' : b.status === 'confirmed' ? 'OK' : '⏳'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
