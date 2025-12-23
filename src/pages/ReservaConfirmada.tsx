import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Clock, MapPin, Loader2, Phone, CreditCard, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { KipperConfirmationBanner } from '@/components/kipper/KipperConfirmationBanner';

interface BookingDetails {
  id: string;
  customer_name: string;
  customer_email: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  address: string | null;
  service_price_cents: number;
  car_type_extra_cents: number;
  requires_payment: boolean;
  is_subscription_booking: boolean;
  payment_status: string;
}

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export default function ReservaConfirmada() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking_id') || searchParams.get('external_reference');
  const paymentMethodParam = searchParams.get('payment_method');
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) {
        setError('No se encontró el ID de la reserva');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('bookings')
          .select('id, customer_name, customer_email, service_name, booking_date, booking_time, address, service_price_cents, car_type_extra_cents, requires_payment, is_subscription_booking, payment_status')
          .eq('id', bookingId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        if (!data) {
          setError('Reserva no encontrada');
        } else {
          setBooking(data);
        }
      } catch (err: any) {
        console.error('Error fetching booking:', err);
        setError('Error al cargar la reserva');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando confirmación...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !booking) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {error || 'Reserva no encontrada'}
            </h1>
            <p className="text-muted-foreground mb-6">
              No pudimos encontrar los detalles de tu reserva. Si realizaste un pago, contactanos.
            </p>
            <div className="flex gap-4 justify-center">
              <Button asChild>
                <Link to="/">Ir al Inicio</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/contacto">Contactar</Link>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const totalPrice = booking.service_price_cents + (booking.car_type_extra_cents || 0);
  
  // Determine payment method from booking data or URL param
  const isPayLater = !booking.requires_payment && !booking.is_subscription_booking;
  const isSubscription = booking.is_subscription_booking;
  const isPaidOnline = booking.requires_payment && booking.payment_status === 'approved';

  // Determine display content based on payment method
  const getPaymentInfo = () => {
    if (isSubscription) {
      return {
        icon: <CreditCard className="w-5 h-5 text-purple-600" />,
        label: "Pagado con Suscripción",
        bgColor: "bg-purple-100",
        textColor: "text-purple-800",
      };
    }
    if (isPayLater) {
      return {
        icon: <Wallet className="w-5 h-5 text-orange-600" />,
        label: "Pago a Coordinar",
        bgColor: "bg-orange-100",
        textColor: "text-orange-800",
      };
    }
    return {
      icon: <CreditCard className="w-5 h-5 text-green-600" />,
      label: "Pagado con MercadoPago",
      bgColor: "bg-green-100",
      textColor: "text-green-800",
    };
  };

  const paymentInfo = getPaymentInfo();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-16 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="w-20 h-20 rounded-full bg-washero-eco/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-washero-eco" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-black text-background mb-4">
              {isPayLater ? (
                <>¡Reserva <span className="text-primary">Recibida</span>!</>
              ) : (
                <>¡Reserva <span className="text-primary">Confirmada</span>!</>
              )}
            </h1>
            <p className="text-lg text-background/70">
              {isPayLater ? (
                <>Te contactamos pronto para coordinar el pago. Enviamos los detalles por email y WhatsApp.</>
              ) : isSubscription ? (
                <>Tu lavado fue reservado con tu suscripción. Te enviamos los detalles por email y WhatsApp.</>
              ) : (
                <>Tu pago fue procesado exitosamente. Te enviamos los detalles por email y WhatsApp.</>
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Booking Details */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-lg mx-auto"
          >
            <div className="bg-secondary rounded-2xl p-8">
              <h2 className="font-display text-xl font-bold text-foreground mb-6">
                Detalles de tu Reserva
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-lg">🚗</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Servicio</p>
                    <p className="font-semibold text-foreground">{booking.service_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha</p>
                    <p className="font-semibold text-foreground capitalize">{formatDate(booking.booking_date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Horario</p>
                    <p className="font-semibold text-foreground">{booking.booking_time} hs</p>
                  </div>
                </div>

                {booking.address && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ubicación</p>
                      <p className="font-semibold text-foreground">{booking.address}</p>
                    </div>
                  </div>
                )}

                {/* Payment Method Badge */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${paymentInfo.bgColor} flex items-center justify-center shrink-0`}>
                    {paymentInfo.icon}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Método de Pago</p>
                    <p className={`font-semibold ${paymentInfo.textColor}`}>{paymentInfo.label}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {isPayLater ? "Total a Pagar" : "Total Pagado"}
                    </span>
                    <span className="font-display text-2xl font-black text-primary">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                </div>

                <div className="bg-primary/10 rounded-lg p-4 mt-4">
                  <p className="text-sm text-center">
                    <span className="font-semibold">ID de Reserva:</span>{' '}
                    <span className="font-mono">{booking.id.substring(0, 8).toUpperCase()}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Pay Later Notice */}
            {isPayLater && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 p-4 rounded-xl bg-orange-50 border border-orange-200"
              >
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-800">¿Cómo sigue?</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Te vamos a contactar por WhatsApp para coordinar el pago antes del lavado. 
                      Aceptamos efectivo o transferencia bancaria.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Next Steps */}
            <div className="mt-8 text-center">
              <h3 className="font-semibold text-foreground mb-3">¿Qué sigue?</h3>
              <ul className="text-sm text-muted-foreground space-y-2 mb-8">
                <li>✅ Recibirás un email de confirmación</li>
                <li>✅ Te contactaremos por WhatsApp antes del lavado</li>
                {isPayLater && <li>✅ Coordinamos el pago por WhatsApp</li>}
                <li>✅ Nuestro equipo llegará puntual a tu ubicación</li>
              </ul>

              <div className="flex gap-4 justify-center">
                <Button variant="hero" size="lg" asChild>
                  <Link to="/">Volver al Inicio</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/reservar">Nueva Reserva</Link>
                </Button>
              </div>
            </div>

            {/* Kipper Seguros Banner */}
            <KipperConfirmationBanner
              customerName={booking.customer_name}
              customerPhone={""}
              customerEmail={booking.customer_email}
              bookingId={booking.id}
            />
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
