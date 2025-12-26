import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, Car, CheckCircle, ChevronRight, Loader2, Send, Sparkles, AlertCircle, MessageCircle, CreditCard, Wallet, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KipperOptIn } from "@/components/kipper/KipperOptIn";
import { AddonsSelector } from "@/components/booking/AddonsSelector";
import { useServiceAddons } from "@/hooks/useServiceAddons";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";

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

type PaymentMethod = "transfer" | "pay_later" | "subscription";

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pay_later");
  
  // Service addons hook
  const { 
    addons, 
    selectedAddons, 
    toggleAddon, 
    isSelected, 
    getAddonsTotal 
  } = useServiceAddons();
  
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
  const [kipperOptIn, setKipperOptIn] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);


  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Reset subscription check when email or phone changes
    if (field === "email" || field === "phone") {
      setHasCheckedSubscription(false);
      setSubscriptionInfo(null);
      if (paymentMethod === "subscription") {
        setPaymentMethod("pay_later");
      }
    }
  };

  const getSelectedService = () => services.find(s => s.id === formData.service);
  const getSelectedCarType = () => carTypes.find(c => c.id === formData.carType);
  
  const getTotalPrice = () => {
    const service = getSelectedService();
    const carType = getSelectedCarType();
    if (!service) return 0;
    return service.priceCents + (carType?.extraCents || 0) + getAddonsTotal();
  };
  
  const getBasePrice = () => {
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

      const isSubscriptionBooking = paymentMethod === "subscription" && subscriptionInfo;
      const isTransfer = paymentMethod === "transfer";
      const isPayLater = paymentMethod === "pay_later";

      console.log("[Reservar] Creating booking - method:", paymentMethod);

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
            paymentMethod: isSubscriptionBooking ? "subscription" : (isTransfer ? "transfer" : "pay_later"),
            isSubscriptionBooking: !!isSubscriptionBooking,
            subscriptionId: isSubscriptionBooking ? subscriptionInfo.id : undefined,
            whatsappOptIn: whatsappOptIn,
            addons: selectedAddons,
            addonsTotalCents: getAddonsTotal(),
          },
        }
      );

      if (bookingError) {
        console.error("[Reservar] Booking error:", bookingError);
        // Check if there's a message in the error
        const errorMessage = bookingError.message || "Error al crear la reserva";
        throw new Error(errorMessage);
      }
      
      // Check for validation errors in the response
      if (bookingResponse?.error) {
        throw new Error(bookingResponse.message || bookingResponse.error);
      }

      console.log("[Reservar] Booking created:", bookingResponse);
      setBookingId(bookingResponse.booking.id);

      // If Kipper opt-in, create lead
      if (kipperOptIn) {
        try {
          await supabase.functions.invoke("create-kipper-lead", {
            body: {
              customerName: formData.name,
              customerPhone: formData.phone,
              customerEmail: formData.email,
              vehicleType: carType?.name,
              bookingId: bookingResponse.booking.id,
              source: "booking",
            },
          });
        } catch (kipperErr) {
          console.error("[Reservar] Kipper lead error:", kipperErr);
        }
      }

      // Navigate based on payment method
      const navPaymentMethod = isSubscriptionBooking ? "subscription" : (isTransfer ? "transfer" : "pay_later");
      navigate(`/reserva-confirmada?booking_id=${bookingResponse.booking.id}&payment_method=${navPaymentMethod}`);

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

                {/* Service Add-ons */}
                {addons.length > 0 && (
                  <AddonsSelector
                    addons={addons}
                    selectedAddons={selectedAddons}
                    onToggle={toggleAddon}
                    isSelected={isSelected}
                  />
                )}
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
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(address) => handleInputChange("address", address ?? "")}
                    placeholder="Ingresá tu dirección"
                  />
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

                {/* WhatsApp Opt-In */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                  <input
                    type="checkbox"
                    id="whatsappOptIn"
                    checked={whatsappOptIn}
                    onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <label htmlFor="whatsappOptIn" className="font-medium text-foreground cursor-pointer flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      Recibir confirmación por WhatsApp
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Además del email, recibirás un mensaje de confirmación a tu WhatsApp.
                    </p>
                  </div>
                </div>

                {/* Kipper Seguros Opt-In */}
                <KipperOptIn 
                  checked={kipperOptIn} 
                  onCheckedChange={setKipperOptIn} 
                />

                {/* Payment Method Selection */}
                <div className="mt-6">
                  <h3 className="font-display text-xl font-bold text-foreground mb-4">
                    Método de Pago
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Option: Pay with Transfer */}
                    {(!subscriptionInfo || !subscriptionInfo.washesRemaining) && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("transfer")}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 ${
                          paymentMethod === "transfer"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#009EE3]/10 flex items-center justify-center shrink-0">
                          <CreditCard className="w-5 h-5 text-[#009EE3]" />
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">
                            Pagar ahora (Transferencia MercadoPago)
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Te enviamos un link de pago por email para transferir
                          </span>
                        </div>
                      </button>
                    )}

                    {/* Option: Pay Later */}
                    {(!subscriptionInfo || !subscriptionInfo.washesRemaining) && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("pay_later")}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 ${
                          paymentMethod === "pay_later"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                          <Wallet className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">
                            Pagar después / Efectivo
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Coordinamos el pago por WhatsApp o pagás en efectivo
                          </span>
                        </div>
                      </button>
                    )}

                    {/* Option: Subscription */}
                    {subscriptionInfo && subscriptionInfo.washesRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("subscription")}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 ${
                          paymentMethod === "subscription"
                            ? "border-purple-500 bg-purple-50"
                            : "border-border hover:border-purple-300"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                          <RefreshCw className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">
                            Usar mi suscripción
                          </span>
                          <span className="text-sm text-purple-600">
                            {subscriptionInfo.washesRemaining} lavado(s) disponible(s) este mes
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Booking Summary */}
                <div className="p-6 rounded-xl bg-secondary mt-4">
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
                    {selectedAddons.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Extras ({selectedAddons.length})</span>
                        <span className="font-medium text-primary">
                          +{formatPrice(getAddonsTotal())}
                        </span>
                      </div>
                    )}
                    {selectedAddons.length > 0 && (
                      <div className="text-xs text-muted-foreground pl-2">
                        {selectedAddons.map(a => a.name).join(", ")}
                      </div>
                    )}
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
                        {paymentMethod === "subscription" ? "Incluido" : formatPrice(getTotalPrice())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method Info */}
                {paymentMethod === "transfer" && (
                  <div className="mt-4 p-4 rounded-xl bg-[#009EE3]/5 border border-[#009EE3]/20">
                    <div className="flex items-start gap-3">
                      <CreditCard className="w-5 h-5 text-[#009EE3] mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        Te enviaremos un email con el monto exacto y el link de pago de MercadoPago. 
                        Tu reserva se confirma cuando recibimos el pago.
                      </p>
                    </div>
                  </div>
                )}
                {paymentMethod === "pay_later" && (
                  <div className="mt-4 p-4 rounded-xl bg-orange-50 border border-orange-200">
                    <div className="flex items-start gap-3">
                      <Wallet className="w-5 h-5 text-orange-600 mt-0.5" />
                      <p className="text-sm text-orange-700">
                        Te contactamos por WhatsApp para coordinar el pago antes del servicio.
                        Aceptamos efectivo o transferencia.
                      </p>
                    </div>
                  </div>
                )}
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
