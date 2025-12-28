import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Save,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  DollarSign,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateKey } from "@/lib/dateUtils";

interface AvailabilityRule {
  id?: string;
  weekday: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
  slot_interval_minutes: number;
}

interface AvailabilityOverride {
  id: string;
  date: string;
  is_closed: boolean;
  note: string | null;
  surcharge_amount: number | null;
  surcharge_percent: number | null;
}

interface SlotOverride {
  id: string;
  date: string;
  time: string;
  is_open: boolean;
}

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function generateTimeSlots(startTime: string, endTime: string, interval: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  while (currentMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`);
    currentMinutes += interval;
  }
  
  return slots;
}

export function DisponibilidadTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Weekly rules
  const [weeklyRules, setWeeklyRules] = useState<AvailabilityRule[]>([]);
  
  // Date overrides
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [slotOverrides, setSlotOverrides] = useState<SlotOverride[]>([]);
  
  // Calendar for selecting dates
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  
  // Selected date for editing
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  
  // Date dialog form state
  const [dateFormClosed, setDateFormClosed] = useState(false);
  const [dateFormNote, setDateFormNote] = useState("");
  const [dateFormSurchargeAmount, setDateFormSurchargeAmount] = useState("");
  const [dateFormSurchargePercent, setDateFormSurchargePercent] = useState("");
  const [dateFormSlots, setDateFormSlots] = useState<{ time: string; isOpen: boolean }[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch weekly rules
      const { data: rulesData, error: rulesError } = await supabase
        .from("availability_rules")
        .select("*")
        .order("weekday");

      if (rulesError) throw rulesError;

      // Ensure all 7 days have a rule
      const rulesMap = new Map<number, AvailabilityRule>();
      for (const rule of rulesData || []) {
        rulesMap.set(rule.weekday, rule);
      }

      const allRules: AvailabilityRule[] = [];
      for (let i = 0; i < 7; i++) {
        allRules.push(
          rulesMap.get(i) || {
            weekday: i,
            is_open: i !== 0, // Default: closed on Sunday
            start_time: "08:00",
            end_time: i === 6 ? "12:00" : "17:00",
            slot_interval_minutes: 60,
          }
        );
      }
      setWeeklyRules(allRules);

      // Fetch date overrides (next 60 days)
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + 60);

      const { data: overridesData, error: overridesError } = await supabase
        .from("availability_overrides")
        .select("*")
        .gte("date", formatDateKey(fromDate))
        .lte("date", formatDateKey(toDate))
        .order("date");

      if (overridesError) throw overridesError;
      setOverrides(overridesData || []);

      // Fetch slot overrides
      const { data: slotOverridesData, error: slotOverridesError } = await supabase
        .from("availability_override_slots")
        .select("*")
        .gte("date", formatDateKey(fromDate))
        .lte("date", formatDateKey(toDate));

      if (slotOverridesError) throw slotOverridesError;
      setSlotOverrides(slotOverridesData || []);

    } catch (error: any) {
      console.error("[DisponibilidadTab] Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar las reglas de disponibilidad",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveWeeklyRule = async (rule: AvailabilityRule) => {
    setIsSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error("No authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-availability`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            type: "weekly_rule",
            weekday: rule.weekday,
            is_open: rule.is_open,
            start_time: rule.start_time,
            end_time: rule.end_time,
            slot_interval_minutes: rule.slot_interval_minutes,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error saving rule");
      }

      toast({
        title: "Guardado",
        description: `Regla de ${WEEKDAYS[rule.weekday]} actualizada`,
      });

      fetchData();
    } catch (error: any) {
      console.error("[DisponibilidadTab] Error saving weekly rule:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo guardar la regla",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRule = (weekday: number, updates: Partial<AvailabilityRule>) => {
    setWeeklyRules((prev) =>
      prev.map((r) => (r.weekday === weekday ? { ...r, ...updates } : r))
    );
  };

  const openDateDialog = (dateStr: string) => {
    setSelectedDate(dateStr);

    const existingOverride = overrides.find((o) => o.date === dateStr);
    const dateSlotOverrides = slotOverrides.filter((so) => so.date === dateStr);

    setDateFormClosed(existingOverride?.is_closed || false);
    setDateFormNote(existingOverride?.note || "");
    setDateFormSurchargeAmount(
      existingOverride?.surcharge_amount ? (existingOverride.surcharge_amount / 100).toString() : ""
    );
    setDateFormSurchargePercent(
      existingOverride?.surcharge_percent ? existingOverride.surcharge_percent.toString() : ""
    );

    // Get the weekday rule for this date - parse in local time
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    const rule = weeklyRules.find((r) => r.weekday === dayOfWeek);

    if (rule && rule.is_open) {
      const baseSlots = generateTimeSlots(rule.start_time, rule.end_time, rule.slot_interval_minutes);
      const slotMap = new Map<string, boolean>();
      
      for (const so of dateSlotOverrides) {
        slotMap.set(so.time, so.is_open);
      }

      setDateFormSlots(
        baseSlots.map((time) => ({
          time,
          isOpen: slotMap.has(time) ? slotMap.get(time)! : true,
        }))
      );
    } else {
      setDateFormSlots([]);
    }

    setIsDateDialogOpen(true);
  };

  const handleSaveDateOverride = async () => {
    if (!selectedDate) return;

    setIsSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error("No authenticated");
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Save date override
      const surchargeAmountCents = dateFormSurchargeAmount
        ? Math.round(parseFloat(dateFormSurchargeAmount) * 100)
        : null;
      const surchargePercent = dateFormSurchargePercent
        ? parseFloat(dateFormSurchargePercent)
        : null;

      const dateResponse = await fetch(`${baseUrl}/functions/v1/admin-update-availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: "date_override",
          date: selectedDate,
          is_closed: dateFormClosed,
          note: dateFormNote || null,
          surcharge_amount: surchargeAmountCents,
          surcharge_percent: surchargePercent,
        }),
      });

      if (!dateResponse.ok) {
        const result = await dateResponse.json();
        throw new Error(result.error || "Error saving date override");
      }

      // Save slot overrides (only the ones that are closed)
      for (const slot of dateFormSlots) {
        if (!slot.isOpen) {
          await fetch(`${baseUrl}/functions/v1/admin-update-availability`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              type: "slot_override",
              date: selectedDate,
              time: slot.time,
              is_open: false,
            }),
          });
        }
      }

      // Delete slot overrides that are now open
      const existingSlotOverrides = slotOverrides.filter((so) => so.date === selectedDate);
      for (const existing of existingSlotOverrides) {
        const formSlot = dateFormSlots.find((s) => s.time === existing.time);
        if (formSlot && formSlot.isOpen) {
          await fetch(`${baseUrl}/functions/v1/admin-update-availability`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              type: "delete_slot_override",
              date: selectedDate,
              time: existing.time,
            }),
          });
        }
      }

      toast({
        title: "Guardado",
        description: `Excepción para ${selectedDate} guardada`,
      });

      setIsDateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("[DisponibilidadTab] Error saving date override:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo guardar la excepción",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDateOverride = async () => {
    if (!selectedDate) return;

    setIsSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error("No authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-availability`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            type: "delete_date_override",
            date: selectedDate,
          }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Error deleting override");
      }

      toast({
        title: "Eliminado",
        description: `Excepción para ${selectedDate} eliminada`,
      });

      setIsDateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("[DisponibilidadTab] Error deleting date override:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo eliminar la excepción",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calendar helpers
  const getMonthDays = (year: number, month: number) => {
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
  };

  // formatDateKey is now imported from @/lib/dateUtils

  const days = getMonthDays(viewYear, viewMonth);
  const todayStr = formatDateKey(today);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Section 1: Weekly Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Reglas Semanales
          </CardTitle>
          <CardDescription>
            Configurá los horarios de apertura predeterminados para cada día de la semana
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {weeklyRules.map((rule) => (
              <div
                key={rule.weekday}
                className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/50"
              >
                <div className="w-24 font-medium">{WEEKDAYS[rule.weekday]}</div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.is_open}
                    onCheckedChange={(checked) =>
                      handleUpdateRule(rule.weekday, { is_open: checked })
                    }
                  />
                  <span className={rule.is_open ? "text-green-600" : "text-muted-foreground"}>
                    {rule.is_open ? "Abierto" : "Cerrado"}
                  </span>
                </div>

                {rule.is_open && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Desde:</Label>
                      <Input
                        type="time"
                        value={rule.start_time}
                        onChange={(e) =>
                          handleUpdateRule(rule.weekday, { start_time: e.target.value })
                        }
                        className="w-28"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Hasta:</Label>
                      <Input
                        type="time"
                        value={rule.end_time}
                        onChange={(e) =>
                          handleUpdateRule(rule.weekday, { end_time: e.target.value })
                        }
                        className="w-28"
                      />
                    </div>
                  </>
                )}

                <Button
                  size="sm"
                  onClick={() => handleSaveWeeklyRule(rule)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">Guardar</span>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Date Overrides Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Excepciones por Fecha
          </CardTitle>
          <CardDescription>
            Hacé clic en una fecha para cerrar el día, bloquear horarios, o agregar recargos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mini calendar navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear(viewYear - 1);
                } else {
                  setViewMonth(viewMonth - 1);
                }
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h3 className="font-semibold">
              {MONTHS[viewMonth]} {viewYear}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear(viewYear + 1);
                } else {
                  setViewMonth(viewMonth + 1);
                }
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS_SHORT.map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dateKey = formatDateKey(date);
              const isPast = dateKey < todayStr;
              const isToday = dateKey === todayStr;
              const override = overrides.find((o) => o.date === dateKey);
              const dateSlotOverrides = slotOverrides.filter((so) => so.date === dateKey);

              const hasOverride = !!override;
              const isClosed = override?.is_closed;
              const hasSurcharge = override?.surcharge_amount || override?.surcharge_percent;
              const hasSlotChanges = dateSlotOverrides.length > 0;

              return (
                <button
                  key={dateKey}
                  onClick={() => !isPast && openDateDialog(dateKey)}
                  disabled={isPast}
                  className={`
                    aspect-square p-1 rounded-lg text-sm flex flex-col items-center justify-center gap-0.5
                    transition-colors relative
                    ${isPast ? "opacity-30 cursor-not-allowed" : "hover:bg-muted cursor-pointer"}
                    ${isToday ? "ring-2 ring-primary" : ""}
                    ${isClosed ? "bg-destructive/10" : ""}
                    ${hasSurcharge && !isClosed ? "bg-yellow-100" : ""}
                    ${hasSlotChanges && !isClosed && !hasSurcharge ? "bg-blue-50" : ""}
                  `}
                >
                  <span className="font-medium">{date.getDate()}</span>
                  <div className="flex gap-0.5">
                    {isClosed && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                    {hasSurcharge && !isClosed && (
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    )}
                    {hasSlotChanges && !isClosed && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              Cerrado
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              Recargo
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Slots modificados
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Upcoming Exceptions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Próximas Excepciones
          </CardTitle>
          <CardDescription>Días con cambios en los próximos 30 días</CardDescription>
        </CardHeader>
        <CardContent>
          {overrides.filter((o) => o.date >= todayStr).length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay excepciones programadas</p>
          ) : (
            <div className="space-y-2">
              {overrides
                .filter((o) => o.date >= todayStr)
                .slice(0, 10)
                .map((override) => {
                  const d = new Date(override.date + "T12:00:00Z");
                  const dateSlotOverrides = slotOverrides.filter((so) => so.date === override.date);

                  return (
                    <div
                      key={override.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                      onClick={() => openDateDialog(override.date)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <div className="text-lg font-bold">{d.getUTCDate()}</div>
                          <div className="text-xs text-muted-foreground">
                            {MONTHS[d.getUTCMonth()].slice(0, 3)}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">{WEEKDAYS[d.getUTCDay()]}</div>
                          {override.note && (
                            <div className="text-sm text-muted-foreground">{override.note}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {override.is_closed && (
                          <Badge variant="destructive">Cerrado</Badge>
                        )}
                        {override.surcharge_amount && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                            +{formatPrice(override.surcharge_amount)}
                          </Badge>
                        )}
                        {override.surcharge_percent && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                            +{override.surcharge_percent}%
                          </Badge>
                        )}
                        {dateSlotOverrides.length > 0 && !override.is_closed && (
                          <Badge variant="outline" className="border-blue-500 text-blue-700">
                            {dateSlotOverrides.length} slots
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date Override Dialog */}
      <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && (() => {
                const d = new Date(selectedDate + "T12:00:00Z");
                return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
              })()}
            </DialogTitle>
            <DialogDescription>
              Configurá excepciones para esta fecha
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Close entire day */}
            <div className="flex items-center justify-between">
              <Label htmlFor="date-closed">Cerrar todo el día</Label>
              <Switch
                id="date-closed"
                checked={dateFormClosed}
                onCheckedChange={setDateFormClosed}
              />
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="date-note">Nota (opcional)</Label>
              <Textarea
                id="date-note"
                placeholder="Ej: Feriado, Mantenimiento, etc."
                value={dateFormNote}
                onChange={(e) => setDateFormNote(e.target.value)}
                rows={2}
              />
            </div>

            {/* Surcharge */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="surcharge-amount">Recargo fijo (ARS)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="surcharge-amount"
                    type="number"
                    placeholder="0"
                    value={dateFormSurchargeAmount}
                    onChange={(e) => setDateFormSurchargeAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="surcharge-percent">Recargo % (opcional)</Label>
                <div className="relative">
                  <Input
                    id="surcharge-percent"
                    type="number"
                    placeholder="0"
                    value={dateFormSurchargePercent}
                    onChange={(e) => setDateFormSurchargePercent(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Slot toggles */}
            {!dateFormClosed && dateFormSlots.length > 0 && (
              <div className="space-y-2">
                <Label>Horarios disponibles</Label>
                <div className="grid grid-cols-4 gap-2">
                  {dateFormSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      type="button"
                      variant={slot.isOpen ? "outline" : "secondary"}
                      size="sm"
                      onClick={() =>
                        setDateFormSlots((prev) =>
                          prev.map((s) =>
                            s.time === slot.time ? { ...s, isOpen: !s.isOpen } : s
                          )
                        )
                      }
                      className={`
                        ${slot.isOpen ? "" : "opacity-50 line-through"}
                      `}
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Hacé clic para bloquear/desbloquear horarios
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {overrides.find((o) => o.date === selectedDate) && (
              <Button
                variant="destructive"
                onClick={handleDeleteDateOverride}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar excepción
              </Button>
            )}
            <Button
              onClick={handleSaveDateOverride}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
