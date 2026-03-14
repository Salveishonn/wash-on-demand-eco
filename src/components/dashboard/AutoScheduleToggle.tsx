import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarCheck, Info } from "lucide-react";

interface AutoScheduleToggleProps {
  washesPerMonth: number;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function AutoScheduleToggle({ washesPerMonth, enabled, onToggle }: AutoScheduleToggleProps) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold cursor-pointer">Auto-programar lavados</Label>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              Programaremos automáticamente {washesPerMonth} lavados distribuidos a lo largo del mes.
              Podés reprogramar cualquier lavado manualmente.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: Math.min(washesPerMonth, 4) }).map((_, i) => (
              <div key={i} className="text-center py-2 px-1 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-xs font-bold text-primary">Semana {i + 1}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
