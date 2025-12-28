import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { CalendarScheduler } from "@/components/booking/CalendarScheduler";

const Reservar = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingSource = searchParams.get("source") || "direct";

  const handleBookingComplete = (bookingId: string, paymentMethod: string) => {
    navigate(`/reserva-confirmada?booking_id=${bookingId}&payment_method=${paymentMethod}`);
  };

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
