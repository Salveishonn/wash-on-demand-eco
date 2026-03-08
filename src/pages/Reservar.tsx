import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { PRELAUNCH_MODE } from "@/config/prelaunch";
import { EarlyAccessPopup } from "@/components/early-access/EarlyAccessPopup";
import { CalendarScheduler } from "@/components/booking/CalendarScheduler";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/gtag";
import { trackPixelEvent } from "@/lib/metaPixel";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronRight } from "lucide-react";

const Reservar = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingSource = searchParams.get("source") || "direct";
  const trackedRef = useRef(false);
  const [showEarlyAccess, setShowEarlyAccess] = useState(false);

  useEffect(() => {
    if (!trackedRef.current) {
      trackEvent("booking_started");
      trackPixelEvent("InitiateCheckout", {
        content_category: "Car Wash Booking",
      });
      trackedRef.current = true;
    }
  }, []);

  const handleBookingComplete = (bookingId: string, paymentMethod: string) => {
    navigate(`/reserva-confirmada?booking_id=${bookingId}&payment_method=${paymentMethod}`);
  };

  if (PRELAUNCH_MODE) {
    return (
      <Layout>
        <EarlyAccessPopup forceOpen={showEarlyAccess} onForceClose={() => setShowEarlyAccess(false)} />
        <section className="py-16 sm:py-24 md:py-32 bg-washero-charcoal">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-semibold mb-8">
                <Sparkles className="w-4 h-4" />
                Próximamente
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-background mb-6">
                Las Reservas se Activan <span className="text-primary">Pronto</span>
              </h1>
              <p className="text-lg sm:text-xl text-background/70 mb-4 leading-relaxed">
                Estamos preparando el lanzamiento de Washero.
              </p>
              <p className="text-base sm:text-lg text-background/60 mb-10">
                Sumate ahora y asegurá <span className="text-primary font-bold">20% OFF</span> para cuando activemos las reservas.
              </p>
              <Button
                variant="hero"
                size="xl"
                onClick={() => setShowEarlyAccess(true)}
              >
                Acceder al 20% OFF <ChevronRight className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Compact Header - Mobile First */}
      <section className="py-6 sm:py-10 md:py-12 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black text-background mb-1 sm:mb-2">
              Reservá Tu <span className="text-primary">Lavado</span>
            </h1>
            <p className="text-sm sm:text-base text-background/70">
              Elegí día y horario
            </p>
          </motion.div>
        </div>
      </section>

      {/* Calendar Scheduler - Compact padding */}
      <section className="py-4 sm:py-8 md:py-10 bg-background">
        <div className="container mx-auto px-3 sm:px-4">
          <CalendarScheduler onBookingComplete={handleBookingComplete} bookingSource={bookingSource} />
        </div>
      </section>
    </Layout>
  );
};

export default Reservar;
