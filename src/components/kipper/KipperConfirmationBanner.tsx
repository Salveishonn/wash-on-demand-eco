import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import kipperLogo from "@/assets/kipper-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface KipperConfirmationBannerProps {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleType?: string;
  bookingId?: string;
}

export function KipperConfirmationBanner({
  customerName,
  customerPhone,
  customerEmail,
  vehicleType,
  bookingId,
}: KipperConfirmationBannerProps) {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRequestContact = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("create-kipper-lead", {
        body: {
          customerName,
          customerPhone,
          customerEmail,
          vehicleType,
          bookingId,
          source: "confirmation",
        },
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "¡Solicitud enviada!",
        description: "Te contactaremos pronto con información sobre beneficios exclusivos.",
      });
    } catch (err: any) {
      console.error("[KipperBanner] Error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar la solicitud. Intentá nuevamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mt-8 rounded-xl overflow-hidden border border-[#8B1E2F]/20"
      >
        <div className="bg-gradient-to-r from-[#8B1E2F] to-[#6B1726] p-1">
          <div className="bg-background rounded-lg p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#8B1E2F]/10 flex items-center justify-center shrink-0">
                <img src={kipperLogo} alt="Kipper" className="w-8 h-8 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#8B1E2F]" />
                    ¿Sabías que podés acceder a descuentos?
                  </h3>
                  <button
                    onClick={() => setIsVisible(false)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Accedé a descuentos exclusivos en Washero si contratás tu seguro con{" "}
                  <span className="font-semibold text-[#8B1E2F]">Kipper Seguros</span>.
                </p>
                
                {isSubmitted ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>¡Listo! Te contactamos pronto.</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleRequestContact}
                    disabled={isSubmitting}
                    className="mt-3 bg-[#8B1E2F] hover:bg-[#6B1726]"
                    size="sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Quiero que me contacten"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
