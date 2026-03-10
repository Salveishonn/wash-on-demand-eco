import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EarlyAccessPopup } from "@/components/early-access/EarlyAccessPopup";

interface PreLaunchModalProps {
  onClose: () => void;
  onPickLaunchDate: () => void;
}

export function PreLaunchModal({ onClose, onPickLaunchDate }: PreLaunchModalProps) {
  const [showEarlyAccess, setShowEarlyAccess] = useState(false);

  return (
    <>
      <EarlyAccessPopup forceOpen={showEarlyAccess} onForceClose={() => { setShowEarlyAccess(false); onClose(); }} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-2xl border border-border shadow-xl max-w-md w-full p-6 sm:p-8 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
              Washero lanza oficialmente el 15 de Abril
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-6 leading-relaxed">
              Todavía no estamos operando, pero podés reservar tu lugar anticipadamente y asegurar tu{" "}
              <span className="font-bold text-primary">20% OFF</span> de lanzamiento.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={() => setShowEarlyAccess(true)}
              >
                Avisarme cuando lancemos
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={onPickLaunchDate}
              >
                Elegir fecha después del 15 de Abril
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
