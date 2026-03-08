import { PRELAUNCH_MODE } from "@/config/prelaunch";
import { Sparkles } from "lucide-react";

export const PrelaunchBanner = () => {
  if (!PRELAUNCH_MODE) return null;

  return (
    <div className="bg-gradient-to-r from-primary/90 to-primary text-washero-charcoal py-2.5 px-4 text-center text-sm font-semibold relative z-[60]">
      <div className="container mx-auto flex items-center justify-center gap-2 flex-wrap">
        <Sparkles className="w-4 h-4 shrink-0" />
        <span>
          Washero llega pronto · Sumate ahora y obtené{" "}
          <span className="font-black">20% OFF</span> en el lanzamiento
        </span>
        <Sparkles className="w-4 h-4 shrink-0" />
      </div>
    </div>
  );
};
