import { motion } from "framer-motion";
import { Rocket, Gift, Users } from "lucide-react";
import { FOUNDING_SLOTS_TOTAL } from "@/config/prelaunch";

interface LaunchBannerProps {
  foundingSlotsRemaining: number | null;
}

export function LaunchBanner({ foundingSlotsRemaining }: LaunchBannerProps) {
  const remaining = foundingSlotsRemaining ?? FOUNDING_SLOTS_TOTAL;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Rocket className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg sm:text-xl font-bold text-foreground mb-1">
            Lanzamiento Washero 🚀
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Reservas disponibles desde el <span className="font-bold text-foreground">15 de Abril</span>.
            <br />
            Los primeros 30 lavados tienen <span className="font-bold text-primary">20% OFF</span> automático.
          </p>

          {/* Founding slots counter */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
            <Gift className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Quedan <span className="text-primary">{remaining} de {FOUNDING_SLOTS_TOTAL}</span> lavados de lanzamiento
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
