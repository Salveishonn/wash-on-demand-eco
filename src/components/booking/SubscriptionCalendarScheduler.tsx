import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Clock, AlertCircle, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { formatDateKey } from "@/lib/dateUtils";
import { SubscriptionWashBookingModal } from "./SubscriptionWashBookingModal";

interface DayAvailability {
  date: string;
  closed: boolean;
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
  surchargeAmount: number | null;
  surchargePercent: number | null;
  note: string | null;
}

interface SlotInfo {
  time: string;
  status: "available" | "booked" | "closed";
  reason?: string;
}

interface UserCar {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  plate: string | null;
}

interface UserAddress {
  id: string;
  label: string | null;
  line1: string;
  neighborhood: string | null;
  city: string | null;
}

interface SubscriptionInfo {
  id: string;
  plan_id: string;
  status: string;
  washes_remaining: number | null;
  washes_used_this_month: number | null;
}

interface SubscriptionCalendarSchedulerProps {
  subscription: SubscriptionInfo;
  cars: UserCar[];
  addresses: UserAddress[];
  userId: string;
  onBookingComplete: () => void;
  onNeedsCar: () => void;
  onNeedsAddress: () => void;
}

const DAYS_SHORT = ["D", "L", "M", "X", "J", "V", "S"];
const DAYS_MEDIUM = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();
  
  const days: (Date | null)[] = [];
  
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  
  return days;
}

function formatDateLong(date: Date): string {
  return `${DAYS_FULL[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()].toLowerCase()}`;
}

export function SubscriptionCalendarScheduler({
  subscription,
  cars,
  addresses,
  userId,
  onBookingComplete,
  onNeedsCar,
  onNeedsAddress,
}: SubscriptionCalendarSchedulerProps) {
  const { toast } = useToast();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Bottom sheet states for mobile slot picker
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  // Subscription booking modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const fetchMonthAvailability = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const from = formatDateKey(firstDay);
      const to = formatDateKey(lastDay);

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
      
      const availabilityMap: Record<string, DayAvailability> = {};
      for (const day of result.availability || []) {
        availabilityMap[day.date] = day;
      }
      
      setAvailability(availabilityMap);
    } catch (error) {
      console.error("[SubscriptionCalendarScheduler] Error fetching availability:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthAvailability(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchMonthAvailability]);

  const fetchSlots = useCallback(async (date: Date) => {
    setIsLoadingSlots(true);
    try {
      const dateKey = formatDateKey(date);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-available-slots?date=${dateKey}`,
        {
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch slots");
      }

      const result = await response.json();
      setSlots(result.slots || []);
    } catch (error) {
      console.error("[SubscriptionCalendarScheduler] Error fetching slots:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los horarios",
      });
    } finally {
      setIsLoadingSlots(false);
    }
  }, [toast]);

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

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const handleDayClick = (date: Date) => {
    const dateKey = formatDateKey(date);
    const dayInfo = availability[dateKey];
    
    if (dayInfo?.closed) return;
    
    const todayStr = formatDateKey(today);
    if (dateKey < todayStr) return;
    
    setSelectedDate(date);
    setSelectedTime(null);
    setSlots([]);
    setIsDrawerOpen(true);
    fetchSlots(date);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setIsDrawerOpen(false);
    setIsBookingModalOpen(true);
  };

  const handleBookingModalClose = () => {
    setIsBookingModalOpen(false);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleBookingSuccess = () => {
    setIsBookingModalOpen(false);
    setIsDrawerOpen(false);
    setSelectedDate(null);
    setSelectedTime(null);
    fetchMonthAvailability(currentYear, currentMonth);
    onBookingComplete();
  };

  const days = getMonthDays(currentYear, currentMonth);
  const todayStr = formatDateKey(today);

  const canGoPrev = currentYear > today.getFullYear() || 
    (currentYear === today.getFullYear() && currentMonth > today.getMonth());

  const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear();

  const availableSlots = useMemo(() => 
    slots.filter(s => s.status === "available"), 
    [slots]
  );

  return (
    <div className="w-full">
      {/* Compact Card Container */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        {/* Month Navigation */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              className="h-10 w-10 sm:h-11 sm:w-11 text-foreground shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-foreground truncate">
                <span className="sm:hidden">{MONTHS_SHORT[currentMonth]} {currentYear}</span>
                <span className="hidden sm:inline">{MONTHS[currentMonth]} {currentYear}</span>
              </h2>
              {!isCurrentMonth && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="h-7 px-2 text-xs shrink-0"
                >
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Hoy</span>
                </Button>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-10 w-10 sm:h-11 sm:w-11 text-foreground shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center py-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}

        {/* Calendar Grid */}
        <div className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {/* Day headers */}
            {DAYS_SHORT.map((day, i) => (
              <div
                key={day}
                className="text-center py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-muted-foreground"
              >
                <span className="sm:hidden">{day}</span>
                <span className="hidden sm:inline">{DAYS_MEDIUM[i]}</span>
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
              const isClosed = dayInfo?.closed;
              const hasAvailability = dayInfo?.availableSlots && dayInfo.availableSlots > 0;
              const isFullyBooked = dayInfo && !dayInfo.closed && dayInfo.availableSlots === 0;
              const isClickable = !isPast && !isClosed;

              return (
                <motion.button
                  key={dateKey}
                  type="button"
                  onClick={() => isClickable && handleDayClick(date)}
                  disabled={!isClickable}
                  whileTap={isClickable ? { scale: 0.92 } : undefined}
                  className={`
                    aspect-square min-h-[44px] min-w-[44px] p-0.5 sm:p-1 rounded-lg sm:rounded-xl 
                    flex flex-col items-center justify-center
                    transition-all relative touch-manipulation
                    ${isPast ? "opacity-30" : ""}
                    ${isClosed && !isPast ? "bg-muted/30" : ""}
                    ${isClickable && hasAvailability ? "hover:bg-primary/10 active:bg-primary/20 cursor-pointer" : ""}
                    ${isClickable && isFullyBooked ? "bg-destructive/5" : ""}
                    ${isToday ? "ring-2 ring-primary ring-inset" : ""}
                    ${!isClickable ? "cursor-not-allowed" : ""}
                  `}
                >
                  <span className={`
                    text-sm sm:text-base font-semibold leading-none
                    ${isToday ? "text-primary" : "text-foreground"}
                    ${isPast || isClosed ? "text-muted-foreground" : ""}
                  `}>
                    {date.getDate()}
                  </span>

                  {/* Availability indicator dot */}
                  {!isPast && !isClosed && dayInfo && (
                    <div className="mt-0.5 sm:mt-1 flex gap-0.5">
                      {hasAvailability ? (
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent" />
                      ) : (
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-destructive/50" />
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 px-3 py-2 sm:py-3 border-t border-border text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-destructive/50" />
            <span>Lleno</span>
          </div>
        </div>
      </div>

      {/* Bottom Sheet Drawer for Slot Selection */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="text-lg font-display">
              Horarios disponibles
            </DrawerTitle>
            <DrawerDescription>
              {selectedDate && formatDateLong(selectedDate)}
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="px-4 pb-6 overflow-y-auto">
            {isLoadingSlots ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm">No hay horarios disponibles para este día</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <Button
                    key={slot.time}
                    variant={slot.status === "available" ? "outline" : "ghost"}
                    disabled={slot.status === "booked"}
                    onClick={() => slot.status === "available" && handleTimeSelect(slot.time)}
                    className={`
                      h-14 sm:h-12 text-base sm:text-sm font-medium
                      ${slot.status === "booked" 
                        ? "opacity-30 cursor-not-allowed line-through" 
                        : "hover:bg-primary hover:text-primary-foreground hover:border-primary active:scale-95"
                      }
                    `}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {slot.time}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Subscription Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && selectedDate && selectedTime && (
          <SubscriptionWashBookingModal
            scheduledDate={selectedDate}
            scheduledTime={selectedTime}
            subscription={subscription}
            cars={cars}
            addresses={addresses}
            userId={userId}
            onClose={handleBookingModalClose}
            onBookingSuccess={handleBookingSuccess}
            onNeedsCar={onNeedsCar}
            onNeedsAddress={onNeedsAddress}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
