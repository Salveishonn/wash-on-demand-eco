import { Button } from "@/components/ui/button";
import { MapPin, Zap, Users } from "lucide-react";

interface NeighborhoodAlertCardProps {
  neighborhood: string;
  confirmedCount: number;
  onBook: () => void;
}

export function NeighborhoodAlertCard({
  neighborhood,
  confirmedCount,
  onBook,
}: NeighborhoodAlertCardProps) {
  if (confirmedCount < 2) return null;

  return (
    <div className="bg-washero-eco/5 border border-washero-eco/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-washero-eco" />
        <span className="text-sm font-bold text-foreground">Día Washero en tu zona</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="w-4 h-4 text-washero-eco" />
        <span className="font-medium text-foreground">{neighborhood}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="w-4 h-4" />
        <span>{confirmedCount} lavados confirmados en la zona</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Reservá ese día y obtené prioridad en la programación.
      </p>
      <Button variant="outline" size="sm" className="w-full" onClick={onBook}>
        Reservar en mi zona
      </Button>
    </div>
  );
}
