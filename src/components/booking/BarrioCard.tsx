import { motion } from "framer-motion";
import { Users } from "lucide-react";

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
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="font-display text-base font-bold text-foreground mb-1">
            Beneficio por zona
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Si <span className="font-semibold text-foreground">3 o más autos reservan el mismo día en tu zona</span>,
            todos reciben <span className="font-bold text-primary">30% OFF automáticamente</span>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            La zona se detecta automáticamente desde tu dirección. No necesitás hacer nada extra.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
