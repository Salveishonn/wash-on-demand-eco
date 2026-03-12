import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

export function BarrioCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="font-display text-base font-bold text-foreground mb-1">
            Descuento por proximidad
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cuantas más reservas haya <span className="font-semibold text-foreground">cerca de tu ubicación el mismo día</span>,
            mayor es el descuento — hasta <span className="font-bold text-primary">20% OFF automáticamente</span>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">1 cerca: 5% OFF</span>
            <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">2 cerca: 10% OFF</span>
            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">3 cerca: 15% OFF</span>
            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">4+ cerca: 20% OFF</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ⭐ en el calendario = zona activa · 🔥 = cluster con descuento alto.
            Se calcula automáticamente desde tu dirección.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
