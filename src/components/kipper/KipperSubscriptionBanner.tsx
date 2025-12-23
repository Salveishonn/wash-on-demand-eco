import { Shield, Star } from "lucide-react";
import kipperLogo from "@/assets/kipper-logo.png";

export function KipperSubscriptionBanner() {
  return (
    <div className="bg-gradient-to-r from-[#8B1E2F]/10 via-[#8B1E2F]/5 to-transparent rounded-2xl p-6 border border-[#8B1E2F]/20">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-[#8B1E2F]/10 flex items-center justify-center shrink-0">
          <img src={kipperLogo} alt="Kipper Seguros" className="w-10 h-10 object-contain" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-[#8B1E2F]" />
            <span className="font-semibold text-foreground">Beneficios exclusivos</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Los clientes de <span className="font-semibold text-[#8B1E2F]">Kipper Seguros</span> acceden a 
            descuentos especiales y beneficios adicionales en todos nuestros planes.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1 text-[#8B1E2F]">
          <Star className="w-4 h-4 fill-current" />
          <Star className="w-4 h-4 fill-current" />
          <Star className="w-4 h-4 fill-current" />
        </div>
      </div>
    </div>
  );
}
