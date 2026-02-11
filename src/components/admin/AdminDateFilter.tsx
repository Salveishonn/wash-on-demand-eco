import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  addDays,
  subWeeks,
  addWeeks,
  subMonths,
  addMonths,
} from "date-fns";
import { es } from "date-fns/locale";

export type DateFilterPeriod = "today" | "week" | "month" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

interface AdminDateFilterProps {
  onDateRangeChange: (range: DateRange | null) => void;
}

export function AdminDateFilter({ onDateRangeChange }: AdminDateFilterProps) {
  const [period, setPeriod] = useState<DateFilterPeriod | "all">("all");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const getRange = (p: DateFilterPeriod | "all", ref: Date): DateRange | null => {
    switch (p) {
      case "today":
        return { from: startOfDay(ref), to: endOfDay(ref) };
      case "week":
        return {
          from: startOfWeek(ref, { locale: es, weekStartsOn: 1 }),
          to: endOfWeek(ref, { locale: es, weekStartsOn: 1 }),
        };
      case "month":
        return { from: startOfMonth(ref), to: endOfMonth(ref) };
      case "all":
        return null;
      default:
        return null;
    }
  };

  const handlePeriodChange = (p: DateFilterPeriod | "all") => {
    setPeriod(p);
    if (p === "custom") return;
    const ref = p === "all" ? new Date() : referenceDate;
    onDateRangeChange(getRange(p, ref));
  };

  const navigate = (dir: "prev" | "next") => {
    const offset = dir === "prev" ? -1 : 1;
    let newDate = referenceDate;
    switch (period) {
      case "today":
        newDate = offset === -1 ? subDays(referenceDate, 1) : addDays(referenceDate, 1);
        break;
      case "week":
        newDate = offset === -1 ? subWeeks(referenceDate, 1) : addWeeks(referenceDate, 1);
        break;
      case "month":
        newDate = offset === -1 ? subMonths(referenceDate, 1) : addMonths(referenceDate, 1);
        break;
    }
    setReferenceDate(newDate);
    onDateRangeChange(getRange(period, newDate));
  };

  const applyCustom = () => {
    if (customFrom && customTo) {
      onDateRangeChange({
        from: startOfDay(new Date(customFrom + "T00:00:00")),
        to: endOfDay(new Date(customTo + "T00:00:00")),
      });
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "today":
        return format(referenceDate, "EEEE d 'de' MMMM", { locale: es });
      case "week": {
        const ws = startOfWeek(referenceDate, { locale: es, weekStartsOn: 1 });
        const we = endOfWeek(referenceDate, { locale: es, weekStartsOn: 1 });
        return `${format(ws, "d MMM", { locale: es })} – ${format(we, "d MMM", { locale: es })}`;
      }
      case "month":
        return format(referenceDate, "MMMM yyyy", { locale: es });
      default:
        return "";
    }
  };

  const options: { value: DateFilterPeriod | "all"; label: string }[] = [
    { value: "all", label: "Todo" },
    { value: "today", label: "Hoy" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
    { value: "custom", label: "Rango" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <div className="flex rounded-lg border border-border overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handlePeriodChange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {period !== "all" && period !== "custom" && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[120px] text-center capitalize">
              {getPeriodLabel()}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setReferenceDate(new Date());
                onDateRangeChange(getRange(period, new Date()));
              }}
            >
              Hoy
            </Button>
          </div>
        )}
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-8 text-xs w-36"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-8 text-xs w-36"
          />
          <Button size="sm" className="h-8 text-xs" onClick={applyCustom} disabled={!customFrom || !customTo}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
