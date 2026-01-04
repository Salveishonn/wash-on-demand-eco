import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, MessageCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { getWhatsAppUrl } from "@/config/whatsapp";

const PLAN_NAMES: Record<string, string> = {
  BASIC_2: "Básico",
  PRO_4: "Pro",
  ULTRA_8: "Ultra",
};

export default function PlanConfirmado() {
  const [searchParams] = useSearchParams();
  const planCode = searchParams.get("plan") || "PRO_4";
  const planName = PLAN_NAMES[planCode] || "Pro";

  const whatsappUrl = getWhatsAppUrl(
    `Hola! Acabo de suscribirme al plan ${planName}. ¿Cómo coordinamos mi primer lavado?`
  );

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto text-center"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-4">
              ¡Plan {planName} Activado!
            </h1>

            <p className="text-muted-foreground mb-8">
              Recibimos tu solicitud. Te contactamos por WhatsApp en los
              próximos minutos para coordinar el pago y tu primer lavado.
            </p>

            <div className="bg-muted/50 rounded-xl p-6 mb-8">
              <h3 className="font-semibold mb-4">Próximos pasos:</h3>
              <div className="space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="text-sm">
                    Te enviamos instrucciones de pago por WhatsApp
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="text-sm">
                    Confirmamos tu pago y activamos el plan
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="text-sm">
                    Coordinamos fecha y hora para tu primer lavado
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Escribinos por WhatsApp
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/">
                  <Calendar className="w-4 h-4 mr-2" />
                  Volver al inicio
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
