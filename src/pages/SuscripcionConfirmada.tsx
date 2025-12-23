import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Calendar, ArrowRight } from "lucide-react";

export default function SuscripcionConfirmada() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") || "active";
  const planName = searchParams.get("plan") || "Suscripción";

  const isPending = status === "pending";

  return (
    <Layout>
      <section className="min-h-[60vh] flex items-center justify-center py-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto text-center"
          >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isPending ? "bg-orange-100" : "bg-green-100"
            }`}>
              {isPending ? (
                <Clock className="w-10 h-10 text-orange-600" />
              ) : (
                <CheckCircle className="w-10 h-10 text-green-600" />
              )}
            </div>

            <h1 className="font-display text-3xl font-bold text-foreground mb-4">
              {isPending ? "¡Solicitud Recibida!" : "¡Suscripción Activa!"}
            </h1>

            <p className="text-lg text-muted-foreground mb-6">
              {isPending ? (
                <>
                  Tu solicitud para el plan <strong>{planName}</strong> fue recibida.
                  <br />
                  Te contactaremos pronto para activar tu suscripción.
                </>
              ) : (
                <>
                  Tu suscripción al plan <strong>{planName}</strong> está activa.
                  <br />
                  Ya podés empezar a reservar tus lavados.
                </>
              )}
            </p>

            <div className="bg-muted/50 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-foreground mb-3">
                {isPending ? "Próximos pasos" : "¿Qué sigue?"}
              </h3>
              {isPending ? (
                <ul className="text-left text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">1.</span>
                    Recibirás un mensaje de WhatsApp o email para coordinar el pago
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">2.</span>
                    Una vez confirmado el pago, activamos tu suscripción
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">3.</span>
                    ¡Listo! Podés empezar a reservar tus lavados
                  </li>
                </ul>
              ) : (
                <ul className="text-left text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    Reservá tu próximo lavado usando tu email y teléfono
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    El sistema detectará tu suscripción automáticamente
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    Sin pagos adicionales hasta agotar tu cuota mensual
                  </li>
                </ul>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!isPending && (
                <Button asChild size="lg">
                  <Link to="/reservar">
                    <Calendar className="w-4 h-4 mr-2" />
                    Reservar ahora
                  </Link>
                </Button>
              )}
              <Button variant="outline" asChild size="lg">
                <Link to="/">
                  Volver al inicio
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}