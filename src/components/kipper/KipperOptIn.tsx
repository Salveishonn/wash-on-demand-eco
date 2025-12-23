import kipperPoweredBy from "@/assets/kipper-powered-by.png";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface KipperOptInProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function KipperOptIn({ checked, onCheckedChange }: KipperOptInProps) {
  return (
    <div className="mt-6 p-4 rounded-xl border border-border bg-gradient-to-r from-[#8B1E2F]/5 to-transparent">
      <div className="flex items-start gap-3">
        <Checkbox
          id="kipper-optin"
          checked={checked}
          onCheckedChange={(val) => onCheckedChange(val === true)}
          className="mt-1 data-[state=checked]:bg-[#8B1E2F] data-[state=checked]:border-[#8B1E2F]"
        />
        <div className="flex-1">
          <Label
            htmlFor="kipper-optin"
            className="text-sm font-medium text-foreground cursor-pointer leading-relaxed"
          >
            Quiero recibir una cotización de seguro con Kipper Seguros y acceder a beneficios exclusivos.
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Sin compromiso. Te contactamos para ofrecerte descuentos especiales en Washero.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <img 
          src={kipperPoweredBy} 
          alt="Powered by Kipper Seguros" 
          className="h-8 object-contain opacity-80"
        />
      </div>
    </div>
  );
}
