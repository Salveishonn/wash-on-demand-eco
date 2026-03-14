import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, Clock } from "lucide-react";
import { format, addDays, setHours, setMinutes, isWeekend } from "date-fns";
import { es } from "date-fns/locale";

interface SuggestedWashCardProps {
  washesPerMonth: number;
  washesRemaining: number;
  lastBookingDate?: string | null;
  onConfirm: () => void;
}

export function SuggestedWashCard({
  washesPerMonth,
  washesRemaining,
  lastBookingDate,
  onConfirm,
}: SuggestedWashCardProps) {
  const [suggestedDate, setSuggestedDate] = useState<Date | null>(null);
  const [suggestedTime, setSuggestedTime] = useState("10:00");

  useEffect(() => {
    calculateSuggestion();
  }, [washesPerMonth, washesRemaining, lastBookingDate]);

  const calculateSuggestion = () => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const intervalDays = Math.floor(daysInMonth / washesPerMonth);

    let baseDate: Date;
    if (lastBookingDate) {
      baseDate = addDays(new Date(lastBookingDate), intervalDays);
    } else {
      baseDate = addDays(now, 2); // Default: 2 days from now
    }

    // Skip weekends
    while (isWeekend(baseDate)) {
      baseDate = addDays(baseDate, 1);
    }

    // Don't suggest dates in the past
    if (baseDate < now) {
      baseDate = addDays(now, 1);
      while (isWeekend(baseDate)) {
        baseDate = addDays(baseDate, 1);
      }
    }

    setSuggestedDate(baseDate);
    setSuggestedTime("10:00");
  };

  if (!suggestedDate || washesRemaining <= 0) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-foreground">Próximo lavado sugerido</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-background rounded-xl px-3 py-2 border border-border">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {format(suggestedDate, "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-background rounded-xl px-3 py-2 border border-border">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{suggestedTime} hs</span>
        </div>
      </div>
      <Button size="default" className="w-full" onClick={onConfirm}>
        <Calendar className="w-4 h-4 mr-2" />
        Confirmar turno
      </Button>
    </div>
  );
}
