import { LAUNCH_DATE } from "@/config/prelaunch";
import { Sparkles } from "lucide-react";

export const PrelaunchBanner = () => {
  const today = new Date();
  const launch = new Date(LAUNCH_DATE + "T00:00:00");

  // Hide banner after launch
  if (today >= launch) return null;

  return (
    <div className="bg-gradient-to-r from-primary/90 to-primary text-washero-charcoal py-2.5 px-4 text-center text-sm font-semibold relative z-[60]">
      <div className="container mx-auto flex items-center justify-center gap-2 flex-wrap">
        <Sparkles className="w-4 h-4 shrink-0" />
        <span>
          Lanzamiento 15 de Abril · Los primeros 30 lavados tienen{" "}
          <span className="font-black">20% OFF</span> automático
        </span>
        <Sparkles className="w-4 h-4 shrink-0" />
      </div>
    </div>
  );
};
