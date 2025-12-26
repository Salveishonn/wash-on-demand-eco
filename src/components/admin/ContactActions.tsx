import { MessageCircle, MapPin, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getWhatsAppUrl, getGoogleMapsUrl } from '@/lib/contactUtils';
import { useToast } from '@/hooks/use-toast';

interface PhoneActionProps {
  phone: string;
  showCopy?: boolean;
  className?: string;
}

export function PhoneAction({ phone, showCopy = true, className = '' }: PhoneActionProps) {
  const { toast } = useToast();
  const whatsappUrl = getWhatsAppUrl(phone);

  const handleCopy = () => {
    navigator.clipboard.writeText(phone);
    toast({ title: 'Copiado', description: 'Teléfono copiado al portapapeles' });
  };

  if (!phone) return <span className="text-muted-foreground">-</span>;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span>{phone}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={() => window.open(whatsappUrl, '_blank')}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enviar WhatsApp</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {showCopy && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copiar teléfono</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

interface AddressActionProps {
  address: string | null;
  lat?: number | null;
  lng?: number | null;
  showCopy?: boolean;
  className?: string;
}

export function AddressAction({ address, lat, lng, showCopy = true, className = '' }: AddressActionProps) {
  const { toast } = useToast();
  const mapsUrl = getGoogleMapsUrl(address || '', lat, lng);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({ title: 'Copiado', description: 'Dirección copiada al portapapeles' });
    }
  };

  if (!address) return <span className="text-muted-foreground">Sin dirección</span>;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex-1">{address}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => window.open(mapsUrl, '_blank')}
              disabled={!mapsUrl}
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Abrir en Google Maps</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {showCopy && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copiar dirección</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
