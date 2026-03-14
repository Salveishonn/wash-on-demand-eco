import { useState } from 'react';
import { Truck, MapPin, Play, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { sendCustomerNotification } from '@/lib/notifications/sendCustomerNotification';
import { toast } from '@/hooks/use-toast';

type JobState = 'assigned' | 'en_route' | 'arrived' | 'in_progress' | 'completed';

interface JobWorkflowActionsProps {
  bookingId: string;
  currentStatus: string;
  customerName: string;
  onStatusChange: () => void;
}

const STATE_CONFIG: Record<JobState, { label: string; icon: typeof Truck; next?: JobState; nextLabel?: string; bookingStatus?: string }> = {
  assigned: {
    label: 'Asignado',
    icon: MapPin,
    next: 'en_route',
    nextLabel: 'En camino 🚐',
  },
  en_route: {
    label: 'En camino',
    icon: Truck,
    next: 'arrived',
    nextLabel: 'Llegamos 📍',
    bookingStatus: 'confirmed',
  },
  arrived: {
    label: 'En el lugar',
    icon: MapPin,
    next: 'in_progress',
    nextLabel: 'Iniciar lavado',
  },
  in_progress: {
    label: 'En proceso',
    icon: Play,
    next: 'completed',
    nextLabel: 'Finalizar trabajo ✅',
  },
  completed: {
    label: 'Completado',
    icon: CheckCircle,
  },
};

function mapToJobState(bookingStatus: string): JobState {
  if (bookingStatus === 'completed') return 'completed';
  if (bookingStatus === 'confirmed') return 'assigned';
  return 'assigned';
}

export default function JobWorkflowActions({ bookingId, currentStatus, customerName, onStatusChange }: JobWorkflowActionsProps) {
  const [jobState, setJobState] = useState<JobState>(mapToJobState(currentStatus));
  const [isUpdating, setIsUpdating] = useState(false);

  const config = STATE_CONFIG[jobState];
  if (!config.next) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg">
        <CheckCircle className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium text-accent">Completado</span>
      </div>
    );
  }

  const handleAdvance = async () => {
    if (!config.next) return;
    setIsUpdating(true);

    try {
      const nextState = config.next;

      // Update booking status when relevant
      if (nextState === 'en_route') {
        await sendCustomerNotification(bookingId, 'ON_MY_WAY');
      }

      if (nextState === 'completed') {
        await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
      }

      setJobState(nextState);
      onStatusChange();

      toast({
        title: `Estado actualizado`,
        description: `${customerName} → ${STATE_CONFIG[nextState].label}`,
      });
    } catch (err) {
      console.error('[JobWorkflow] Error:', err);
      toast({ title: 'Error al actualizar', variant: 'destructive' });
    }

    setIsUpdating(false);
  };

  const nextConfig = STATE_CONFIG[config.next];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <config.icon className="w-3.5 h-3.5" />
        <span>Estado: <strong className="text-foreground">{config.label}</strong></span>
      </div>
      <Button
        size="sm"
        className="w-full h-11 text-sm font-semibold gap-2"
        disabled={isUpdating}
        onClick={handleAdvance}
      >
        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <nextConfig.icon className="w-4 h-4" />}
        {config.nextLabel}
      </Button>
    </div>
  );
}
