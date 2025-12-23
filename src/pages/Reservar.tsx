import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Car, CheckCircle, ChevronRight, Loader2, CreditCard, Wallet, Send, Sparkles, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENTS_ENABLED } from "@/config/payments";

interface Service {
  id: string;
  name: string;
  price: string;
  priceCents: number;
  time: string;
  popular?: boolean;
}

interface CarType {
  id: string;
  name: string;
  extra: string;
  extraCents: number;
}

interface SubscriptionInfo {
  id: string;
  planName: string;
  washesPerMonth: number;
  washesRemaining: number;
  washesUsed: number;
  periodEnd: string;
}

type PaymentMethod = "online" | "pay_later" | "subscription";

const services: Service[] = [
  { id: "exterior", name: "Lavado Exterior", price: "$25.000", priceCents: 2500000, time: "45 min" },
  { id: "interior", name: "Limpieza Interior", price: "$35.000", priceCents: 3500000, time: "60 min" },
  { id: "full-detail", name: "Detailing Completo", price: "$75.000", priceCents: 7500000, time: "2-3 horas", popular: true },
];

const carTypes: CarType[] = [
  { id: "sedan", name: "Sedán", extra: "$0", extraCents: 0 },
  { id: "suv", name: "SUV / Crossover", extra: "+$7.000", extraCents: 700000 },
  { id: "camioneta", name: "Camioneta / Van", extra: "+$12.000", extraCents: 1200000 },
  { id: "premium", name: "Premium / Deportivo", extra: "+$10.000", extraCents: 1000000 },
];

const timeSlots = [
  "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00"
];

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const Reservar = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialService = searchParams.get("servicio") || "";
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PAYMENTS_ENABLED ? "online" : "pay_later"
  );
  
  const [formData, setFormData] = useState({
    service: initialService,
    carType: "",
    date: "",
    time: "",
    address: "",
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  // Check for payment return (only when payments enabled)
  useEffect(() => {
    if (!PAYMENTS_ENABLED) return;
    
    const paymentStatus = searchParams.get("collection_status");
    const externalRef = searchParams.get("external_reference");
    
    if (paymentStatus === "approved" && externalRef) {
      // Redirect to confirmation page
      navigate(`/reserva-confirmada?booking_id=${externalRef}&payment_method=online`);
    } else if (paymentStatus === "rejected" || paymentStatus === "failure") {
      toast({
        variant: "destructive",
        title: "Pago Rechazado",
        description: "Hubo un problema con tu pago. Por favor, intentá nuevamente.",
      });
    }
  }, [searchParams, toast, navigate]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Reset subscription check when email or phone changes
    if (field === "email" || field === "phone") {
      setHasCheckedSubscription(false);
      setSubscriptionInfo(null);
      if (paymentMethod === "subscription") {
        setPaymentMethod(PAYMENTS_ENABLED ? "online" : "pay_later");
      }
    }
  };

  const getSelectedService = () => services.find(s => s.id === formData.service);
  const getSelectedCarType = () => carTypes.find(c => c.id === formData.carType);
  
  const getTotalPrice = () => {
    const service = getSelectedService();
    const carType = getSelectedCarType();
    if (!service) return 0;
    return service.priceCents + (carType?.extraCents || 0);
  };

  // Check subscription when email and phone are entered
  const checkSubscription = async () => {
    if (!formData.email || !formData.phone) return;
    
    setIsCheckingSubscription(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        body: {
          customerEmail: formData.email,
          customerPhone: formData.phone,
        },
      });

      if (error) throw error;

      console.log("[Reservar] Subscription check:", data);

      if (data.hasActiveSubscription && data.hasQuota) {
        setSubscriptionInfo(data.subscription);
        setPaymentMethod("subscription");
        toast({
          title: "¡Suscripción detectada!",
          description: data.message,
        });
      } else if (data.hasActiveSubscription && !data.hasQuota) {
        setSubscriptionInfo(data.subscription);
        toast({
          variant: "destructive",
          title: "Cuota agotada",
          description: data.message,
        });
      }
      
      setHasCheckedSubscription(true);
    } catch (error: any) {
      console.error("[Reservar] Subscription check error:", error);
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  // Auto-check subscription when email and phone are filled
  useEffect(() => {
    if (formData.email && formData.phone && !hasCheckedSubscription && step === 3) {
      const timer = setTimeout(() => {
        checkSubscription();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.email, formData.phone, step]);

  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      const service = getSelectedService();
      const carType = getSelectedCarType();
      
      if (!service) {
        throw new Error("Seleccioná un servicio");
      }

      const isPayLater = paymentMethod === "pay_later" || !PAYMENTS_ENABLED;
      console.log("[Reservar] Creating booking... paymentMethod:", paymentMethod, "isPayLater:", isPayLater);

      // Create booking via edge function
      const { data: bookingResponse, error: bookingError } = await supabase.functions.invoke(
        "create-booking",
        {
          body: {
            customerName: formData.name,
            customerEmail: formData.email,
            customerPhone: formData.phone,
            serviceName: service.name,
            servicePriceCents: service.priceCents,
            carType: carType?.name || "",
            carTypeExtraCents: carType?.extraCents || 0,
            bookingDate: formData.date,
            bookingTime: formData.time,
            address: formData.address,
            notes: formData.notes,
            paymentMethod: isPayLater ? "pay_later" : "mercadopago",
            paymentsEnabled: PAYMENTS_ENABLED,
          },
        }
      );

      if (bookingError) {
        console.error("[Reservar] Booking error:", bookingError);
        throw new Error("Error al crear la reserva");
      }

      console.log("[Reservar] Booking created:", bookingResponse);
      setBookingId(bookingResponse.booking.id);

      // If pay later, go straight to confirmation page
      if (isPayLater) {
        navigate(`/reserva-confirmada?booking_id=${bookingResponse.booking.id}&payment_method=pay_later`);
        return;
      }

      // Online payment: Create MercadoPago preference
      console.log("[Reservar] Creating MercadoPago preference...");
      
      const { data: mpResponse, error: mpError } = await supabase.functions.invoke(
        "create-mercadopago-preference",
        {
          body: {
            bookingId: bookingResponse.booking.id,
            title: `Washero - ${service.name}`,
            description: `Lavado de auto ${carType?.name || ''} - ${formData.date} ${formData.time}hs`,
            priceInCents: getTotalPrice(),
            customerEmail: formData.email,
            customerName: formData.name,
          },
        }
      );

      if (mpError) {
        console.error("[Reservar] MercadoPago error:", mpError);
        throw new Error("Error al procesar el pago. Intentá con Pagar Después.");
      }

      console.log("[Reservar] MercadoPago preference created:", mpResponse);

      // Redirect to MercadoPago
      if (mpResponse.initPoint) {
        toast({
          title: "Redirigiendo a MercadoPago...",
          description: "Serás redirigido para completar el pago.",
        });
        
        setTimeout(() => {
          window.location.href = mpResponse.initPoint;
        }, 1000);
      } else {
        throw new Error("No se pudo obtener el link de pago");
      }

    } catch (error: any) {
      console.error("[Reservar] Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Hubo un problema al procesar tu reserva",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.service && formData.carType;
      case 2:
        return formData.date && formData.time && formData.address;
      case 3:
        return formData.name && formData.email && formData.phone;
      default:
        return false;
    }
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
              Agendá tu lavado premium en solo unos clicks
            </p>
          </motion.div>
        </div>
      </section>

      {/* Progress Bar */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 md:gap-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 md:gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold transition-all ${
                    step >= s
                      ? "bg-primary text-washero-charcoal"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
                <span className={`hidden md:block text-sm font-medium ${
                  step >= s ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {s === 1 ? "Servicio" : s === 2 ? "Agenda" : "Datos y Pago"}
                </span>
                {s < 3 && (
                  <div className={`w-12 md:w-24 h-1 rounded ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form Content */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            {/* Step 1: Service Selection */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Elegí Tu Servicio
                  </h2>
                  <div className="space-y-4">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleInputChange("service", service.id)}
                        className={`w-full p-6 rounded-xl border-2 text-left transition-all ${
                          formData.service === service.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-lg text-foreground">
                                {service.name}
                              </span>
                              {service.popular && (
                                <span className="px-2 py-0.5 bg-primary text-washero-charcoal text-xs font-semibold rounded">
                                  Popular
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="w-4 h-4" /> {service.time}
                            </span>
                          </div>
                          <span className="font-display text-2xl font-black text-primary">
                            {service.price}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Tipo de Vehículo
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {carTypes.map((car) => (
                      <button
                        key={car.id}
                        type="button"
                        onClick={() => handleInputChange("carType", car.id)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          formData.carType === car.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Car className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <span className="font-semibold text-foreground block">
                          {car.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {car.extra}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Schedule */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Elegí una Fecha
                  </h2>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange("date", e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="pl-12 h-14 text-lg"
                    />
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Seleccioná Horario
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleInputChange("time", slot)}
                        className={`p-3 rounded-lg border-2 text-center font-medium transition-all ${
                          formData.time === slot
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {slot} hs
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Ubicación
                  </h2>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Ingresá tu dirección"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="pl-12 h-14 text-lg"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Casa, oficina o cualquier lugar con acceso al vehículo
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Contact Details & Payment */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                  Tus Datos
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nombre Completo</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Juan Pérez"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="h-14 text-lg mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="juan@ejemplo.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="h-14 text-lg mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+54 11 1234-5678"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="h-14 text-lg mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="notes">Notas Adicionales (Opcional)</Label>
                    <Input
                      id="notes"
                      type="text"
                      placeholder="Instrucciones especiales..."
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      className="h-14 text-lg mt-2"
                    />
                  </div>
                </div>

                {/* Order Summary */}
                <div className="p-6 rounded-xl bg-secondary mt-8">
                  <h3 className="font-display font-bold text-foreground mb-4">
                    Resumen de tu Reserva
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Servicio</span>
                      <span className="font-medium">
                        {getSelectedService()?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Precio servicio</span>
                      <span className="font-medium">
                        {getSelectedService()?.price}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehículo</span>
                      <span className="font-medium">
                        {getSelectedCarType()?.name} ({getSelectedCarType()?.extra})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha y Hora</span>
                      <span className="font-medium">{formData.date} a las {formData.time} hs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ubicación</span>
                      <span className="font-medium truncate max-w-[200px]">{formData.address}</span>
                    </div>
                    <div className="border-t border-border pt-3 mt-3 flex justify-between items-center">
                      <span className="font-semibold text-lg">Total</span>
                      <span className="font-display font-black text-primary text-2xl">
                        {formatPrice(getTotalPrice())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div className="mt-8">
                  <h3 className="font-display font-bold text-foreground mb-4">
                    ¿Cómo querés pagar?
                  </h3>
                  <div className="space-y-3">
                    {/* Pay Online Option */}
                    <button
                      type="button"
                      onClick={() => PAYMENTS_ENABLED && setPaymentMethod("online")}
                      disabled={!PAYMENTS_ENABLED}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "online" && PAYMENTS_ENABLED
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      } ${!PAYMENTS_ENABLED ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          paymentMethod === "online" && PAYMENTS_ENABLED ? "bg-primary/20" : "bg-muted"
                        }`}>
                          <CreditCard className={`w-6 h-6 ${
                            paymentMethod === "online" && PAYMENTS_ENABLED ? "text-primary" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              Pagar ahora online
                            </span>
                            {paymentMethod === "online" && PAYMENTS_ENABLED && (
                              <CheckCircle className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {PAYMENTS_ENABLED 
                              ? "Pago seguro con MercadoPago. Tarjetas, transferencia, efectivo en puntos de pago."
                              : "No disponible temporalmente"
                            }
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Pay Later Option */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("pay_later")}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "pay_later"
                          ? "border-washero-eco bg-washero-eco/5"
                          : "border-border hover:border-washero-eco/50"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          paymentMethod === "pay_later" ? "bg-washero-eco/20" : "bg-muted"
                        }`}>
                          <Wallet className={`w-6 h-6 ${
                            paymentMethod === "pay_later" ? "text-washero-eco" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              Pagar después (efectivo / transferencia)
                            </span>
                            {paymentMethod === "pay_later" && (
                              <CheckCircle className="w-5 h-5 text-washero-eco" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Coordinamos el pago por WhatsApp. Pagá en efectivo o transferencia antes del lavado.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            {step <= 3 && (
              <div className="flex justify-between mt-12">
                {step > 1 ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setStep(step - 1)}
                    disabled={isLoading}
                  >
                    Atrás
                  </Button>
                ) : (
                  <div />
                )}
                
                {step < 3 ? (
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={() => setStep(step + 1)}
                    disabled={!canProceed()}
                  >
                    Continuar <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!canProceed() || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Procesando...
                      </>
                    ) : paymentMethod === "online" && PAYMENTS_ENABLED ? (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pagar {formatPrice(getTotalPrice())}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Confirmar Reserva
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Reservar;
