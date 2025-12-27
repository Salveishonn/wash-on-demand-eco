import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SlotModal } from "./SlotModal";

interface DayAvailability {
  date: string;
  closed: boolean;
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
}

interface CalendarSchedulerProps {
  onBookingComplete: (bookingId: string, paymentMethod: string) => void;
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();
  
  const days: (Date | null)[] = [];
  
  // Add empty cells for days before the first of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  
  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  
  return days;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function CalendarScheduler({ onBookingComplete }: CalendarSchedulerProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMonthAvailability = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const from = formatDateKey(firstDay);
      const to = formatDateKey(lastDay);

      const { data, error } = await supabase.functions.invoke("get-availability-month", {
        body: null,
        headers: {},
      });

      // Use fetch directly for query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-availability-month?from=${from}&to=${to}`,
        {
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch availability");
      }

      const result = await response.json();
      
      // Convert array to map
      const availabilityMap: Record<string, DayAvailability> = {};
      for (const day of result.availability || []) {
        availabilityMap[day.date] = day;
      }
      
      setAvailability(availabilityMap);
    } catch (error) {
      console.error("[CalendarScheduler] Error fetching availability:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthAvailability(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchMonthAvailability]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (date: Date) => {
    const dateKey = formatDateKey(date);
    const dayInfo = availability[dateKey];
    
    // Don't allow clicking on closed days or days with no availability
    if (dayInfo?.closed) return;
    
    // Don't allow past dates
    const todayStr = formatDateKey(today);
    if (dateKey < todayStr) return;
    
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
  };

  const handleBookingSuccess = (bookingId: string, paymentMethod: string) => {
    setIsModalOpen(false);
    setSelectedDate(null);
    // Refresh availability
    fetchMonthAvailability(currentYear, currentMonth);
    onBookingComplete(bookingId, paymentMethod);
  };

  const days = getMonthDays(currentYear, currentMonth);
  const todayStr = formatDateKey(today);

  // Check if we can go to previous month (not before current month)
  const canGoPrev = currentYear > today.getFullYear() || 
    (currentYear === today.getFullYear() && currentMonth > today.getMonth());

  return (
    <div className="w-full">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className="text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <h2 className="font-display text-xl font-bold text-foreground">
          {MONTHS[currentMonth]} {currentYear}
        </h2>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="text-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {/* Day headers */}
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center py-2 text-sm font-semibold text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateKey = formatDateKey(date);
          const dayInfo = availability[dateKey];
          const isPast = dateKey < todayStr;
          const isToday = dateKey === todayStr;
          const isClosed = dayInfo?.closed || date.getDay() === 0;
          const hasAvailability = dayInfo?.availableSlots && dayInfo.availableSlots > 0;
          const isFullyBooked = dayInfo && !dayInfo.closed && dayInfo.availableSlots === 0;

          const isClickable = !isPast && !isClosed;

          return (
            <motion.button
              key={dateKey}
              type="button"
              onClick={() => isClickable && handleDayClick(date)}
              disabled={!isClickable}
              whileTap={isClickable ? { scale: 0.95 } : undefined}
              className={`
                aspect-square p-1 md:p-2 rounded-xl flex flex-col items-center justify-center
                transition-all relative
                ${isPast ? "opacity-40 cursor-not-allowed" : ""}
                ${isClosed && !isPast ? "bg-muted/50 cursor-not-allowed" : ""}
                ${isClickable && hasAvailability ? "hover:bg-primary/10 hover:border-primary cursor-pointer border-2 border-transparent" : ""}
                ${isClickable && isFullyBooked ? "bg-destructive/10 cursor-not-allowed" : ""}
                ${isToday ? "ring-2 ring-primary ring-offset-2" : ""}
              `}
            >
              <span className={`
                text-sm md:text-base font-semibold
                ${isToday ? "text-primary" : "text-foreground"}
                ${isPast ? "text-muted-foreground" : ""}
                ${isClosed && !isPast ? "text-muted-foreground" : ""}
              `}>
                {date.getDate()}
              </span>

              {/* Availability indicator */}
              {!isPast && !isClosed && dayInfo && (
                <div className="mt-0.5">
                  {hasAvailability ? (
                    <span className="text-[10px] md:text-xs text-accent font-medium">
                      {dayInfo.availableSlots} disp.
                    </span>
                  ) : (
                    <span className="text-[10px] md:text-xs text-destructive font-medium">
                      Lleno
                    </span>
                  )}
                </div>
              )}

              {/* Closed indicator */}
              {!isPast && isClosed && (
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  Cerrado
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 text-sm text-muted-foreground justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive/50" />
          <span>Lleno</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span>Cerrado</span>
        </div>
      </div>

      {/* Slot Modal */}
      <AnimatePresence>
        {isModalOpen && selectedDate && (
          <SlotModal
            date={selectedDate}
            onClose={handleModalClose}
            onBookingSuccess={handleBookingSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
}