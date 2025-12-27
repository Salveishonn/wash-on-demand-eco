import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { CalendarScheduler } from "@/components/booking/CalendarScheduler";

const Reservar = () => {
  const navigate = useNavigate();

  const handleBookingComplete = (bookingId: string, paymentMethod: string) => {
    navigate(`/reserva-confirmada?booking_id=${bookingId}&payment_method=${paymentMethod}`);
  };

  return (
    <Layout>
      {/* Header */}
      <section className="py-16 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display text-4xl md:text-5xl font-black text-background mb-4">
              Reservá Tu <span className="text-primary">Lavado</span>
            </h1>
            <p className="text-lg text-background/70">
              Seleccioná un día y horario para agendar tu lavado premium
            </p>
          </motion.div>
        </div>
      </section>

      {/* Calendar Scheduler */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <CalendarScheduler onBookingComplete={handleBookingComplete} />
        </div>
      </section>
    </Layout>
  );
};

export default Reservar;
