import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Clock, Loader2, User, Phone, Mail, CreditCard, Wallet, RefreshCw, Check, AlertCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddonsSelector } from "./AddonsSelector";
import { useServiceAddons } from "@/hooks/useServiceAddons";
import { KipperOptIn } from "@/components/kipper/KipperOptIn";
import { AddressAutocomplete, PlaceSelection } from "./AddressAutocomplete";
import { formatDateKey } from "@/lib/dateUtils";

interface SlotInfo {
  time: string;
  status: "available" | "booked";
}

interface SlotModalProps {
  date: Date;
  preselectedTime?: string | null;
  onClose: () => void;
  onBookingSuccess: (bookingId: string, paymentMethod: string) => void;
}

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

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function formatDateLong(date: Date): string {
  return `${DAYS_FULL[date.getDay()]} ${date.getDate()} de ${MONTHS_FULL[date.getMonth()]}`;
}

// formatDateKey is now imported from @/lib/dateUtils

export function SlotModal({ date, preselectedTime, onClose, onBookingSuccess }: SlotModalProps) {
  const { toast } = useToast();
  // If preselectedTime is provided, skip directly to form
  const [step, setStep] = useState<"slots" | "form">(preselectedTime ? "form" : "slots");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(!preselectedTime);
  const [selectedTime, setSelectedTime] = useState<string | null>(preselectedTime || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    service: "",
    carType: "",
    address: "",
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  // Subscription state
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pay_later");

  // Opt-ins
  const [kipperOptIn, setKipperOptIn] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);

  // Addons
  const { addons, selectedAddons, toggleAddon, isSelected, getAddonsTotal } = useServiceAddons();

  const fetchSlots = useCallback(async () => {
    setIsLoadingSlots(true);
    try {
      const dateKey = formatDateKey(date);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-available-slots?date=${dateKey}`,
        {
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch slots");
      }

      const result = await response.json();
      setSlots(result.slots || []);
    } catch (error) {
      console.error("[SlotModal] Error fetching slots:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los horarios",
      });
    } finally {
      setIsLoadingSlots(false);
    }
  }, [date, toast]);

  useEffect(() => {
    // Only fetch slots if we don't have a preselected time
    if (!preselectedTime) {
      fetchSlots();
    }
  }, [fetchSlots, preselectedTime]);

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep("form");
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "email" || field === "phone") {
      setHasCheckedSubscription(false);
      setSubscriptionInfo(null);
      if (paymentMethod === "subscription") {
        setPaymentMethod("pay_later");
      }
    }
  };

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
      console.error("[SlotModal] Subscription check error:", error);
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  // Auto-check subscription when email and phone are filled
  useEffect(() => {
    if (formData.email && formData.phone && !hasCheckedSubscription && step === "form") {
      const timer = setTimeout(() => {
        checkSubscription();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.email, formData.phone, step, hasCheckedSubscription]);

  const getSelectedService = () => services.find(s => s.id === formData.service);
  const getSelectedCarType = () => carTypes.find(c => c.id === formData.carType);

  const getTotalPrice = () => {
    const service = getSelectedService();
    const carType = getSelectedCarType();
    if (!service) return 0;
    return service.priceCents + (carType?.extraCents || 0) + getAddonsTotal();
  };

  const canSubmit = () => {
    return (
      formData.service &&
      formData.carType &&
      formData.address.trim() &&
      formData.name.trim() &&
      formData.email.trim() &&
      formData.phone.trim() &&
      selectedTime
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    setIsSubmitting(true);
    try {
      const service = getSelectedService();
      const carType = getSelectedCarType();

      if (!service || !selectedTime) {
        throw new Error("Faltan datos requeridos");
      }

      const isSubscriptionBooking = paymentMethod === "subscription" && subscriptionInfo;
      const bookingPaymentMethod = isSubscriptionBooking ? "subscription" : paymentMethod;

      const { data: bookingResponse, error: bookingError } = await supabase.functions.invoke(
        "create-booking",
        {
          body: {
            customerName: formData.name.trim(),
            customerEmail: formData.email.trim(),
            customerPhone: formData.phone.trim(),
            serviceName: service.name,
            servicePriceCents: service.priceCents,
            carType: carType?.name || "",
            carTypeExtraCents: carType?.extraCents || 0,
            bookingDate: formatDateKey(date),
            bookingTime: selectedTime,
            address: formData.address.trim(),
            notes: formData.notes.trim(),
            paymentMethod: bookingPaymentMethod,
            isSubscriptionBooking: !!isSubscriptionBooking,
            subscriptionId: isSubscriptionBooking ? subscriptionInfo.id : undefined,
            whatsappOptIn: whatsappOptIn,
            addons: selectedAddons,
            addonsTotalCents: getAddonsTotal(),
          },
        }
      );

      if (bookingError) {
        throw new Error(bookingError.message || "Error al crear la reserva");
      }

      // Check for slot taken error
      if (bookingResponse?.slotTaken) {
        toast({
          variant: "destructive",
          title: "Horario no disponible",
          description: "Ese horario ya fue reservado. Elegí otro.",
        });
        // Refresh slots and go back
        await fetchSlots();
        setStep("slots");
        setSelectedTime(null);
        return;
      }

      if (bookingResponse?.error) {
        throw new Error(bookingResponse.message || bookingResponse.error);
      }

      // If Kipper opt-in, create lead
      if (kipperOptIn && bookingResponse?.booking?.id) {
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
          console.error("[SlotModal] Kipper lead error:", kipperErr);
        }
      }

      toast({
        title: "¡Reserva creada!",
        description: bookingResponse.message,
      });

      onBookingSuccess(bookingResponse.booking.id, bookingPaymentMethod);
    } catch (error: any) {
      console.error("[SlotModal] Submit error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Hubo un problema al crear la reserva",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background rounded-2xl shadow-xl border border-border"
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {step === "slots" ? "Elegí un horario" : "Completá tu reserva"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatDateLong(date)}
              {selectedTime && step === "form" && ` · ${selectedTime} hs`}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {step === "slots" && (
            <>
              {isLoadingSlots ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>No hay horarios disponibles para este día</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={slot.status === "available" ? "outline" : "ghost"}
                      disabled={slot.status === "booked"}
                      onClick={() => slot.status === "available" && handleTimeSelect(slot.time)}
                      className={`
                        h-12
                        ${slot.status === "booked" ? "opacity-40 cursor-not-allowed line-through" : "hover:bg-primary hover:text-primary-foreground"}
                      `}
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "form" && (
            <>
              {/* Back button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("slots");
                  setSelectedTime(null);
                }}
                className="text-muted-foreground"
              >
                ← Cambiar horario
              </Button>

              {/* Service Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Servicio</Label>
                <div className="grid gap-2">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleInputChange("service", service.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.service === service.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-foreground">{service.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({service.time})</span>
                        </div>
                        <span className="font-bold text-primary">{service.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Car Type Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Tipo de vehículo</Label>
                <div className="grid grid-cols-2 gap-2">
                  {carTypes.map((carType) => (
                    <button
                      key={carType.id}
                      type="button"
                      onClick={() => handleInputChange("carType", carType.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        formData.carType === carType.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-medium text-foreground text-sm">{carType.name}</div>
                      <div className="text-xs text-muted-foreground">{carType.extra}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Addons */}
              <AddonsSelector
                addons={addons}
                selectedAddons={selectedAddons}
                onToggle={toggleAddon}
                isSelected={isSelected}
              />

              {/* Address with Google Places Autocomplete */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Dirección</Label>
                <AddressAutocomplete
                  key={step === "form" ? "form-open" : "form-closed"}
                  initialValue={formData.address}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  onTextChange={(text) => handleInputChange("address", text)}
                  onSelect={(selection: PlaceSelection) => {
                    handleInputChange("address", selection.address);
                  }}
                />
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="w-4 h-4" /> Nombre completo
                  </Label>
                  <Input
                    id="name"
                    placeholder="Tu nombre"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Teléfono / WhatsApp
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+54 11 1234-5678"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>

                {isCheckingSubscription && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando suscripción...
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas adicionales (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Instrucciones especiales, código de acceso, etc."
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={2}
                />
              </div>

              {/* WhatsApp Opt-in */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <input
                  type="checkbox"
                  id="whatsapp"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="whatsapp" className="text-sm text-muted-foreground">
                  <MessageCircle className="w-4 h-4 inline mr-1" />
                  Recibir recordatorio por WhatsApp
                </label>
              </div>

              {/* Kipper Opt-in */}
              <KipperOptIn 
                checked={kipperOptIn} 
                onCheckedChange={setKipperOptIn}
              />

              {/* Payment Method */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Método de pago</Label>
                <div className="space-y-2">
                  {subscriptionInfo && subscriptionInfo.washesRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("subscription")}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "subscription"
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-accent" />
                        <div>
                          <div className="font-semibold text-foreground">Usar suscripción</div>
                          <div className="text-sm text-muted-foreground">
                            {subscriptionInfo.washesRemaining} lavado{subscriptionInfo.washesRemaining > 1 ? 's' : ''} disponible{subscriptionInfo.washesRemaining > 1 ? 's' : ''}
                          </div>
                        </div>
                        {paymentMethod === "subscription" && (
                          <Check className="w-5 h-5 text-accent ml-auto" />
                        )}
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("transfer")}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      paymentMethod === "transfer"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-semibold text-foreground">Transferencia / MercadoPago</div>
                        <div className="text-sm text-muted-foreground">Te enviamos los datos para pagar</div>
                      </div>
                      {paymentMethod === "transfer" && (
                        <Check className="w-5 h-5 text-primary ml-auto" />
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("pay_later")}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      paymentMethod === "pay_later"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-semibold text-foreground">Pago en persona</div>
                        <div className="text-sm text-muted-foreground">Pagá cuando hagamos el lavado</div>
                      </div>
                      {paymentMethod === "pay_later" && (
                        <Check className="w-5 h-5 text-primary ml-auto" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Total */}
              {formData.service && paymentMethod !== "subscription" && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-medium">Total a pagar</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(getTotalPrice())}
                    </span>
                  </div>
                </div>
              )}

              {paymentMethod === "subscription" && (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-medium">Incluido en tu suscripción</span>
                    <span className="text-lg font-bold text-accent">$0</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                className="w-full h-14 text-lg font-bold"
                size="lg"
                onClick={handleSubmit}
                disabled={!canSubmit() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Reservando...
                  </>
                ) : (
                  "Confirmar Reserva"
                )}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}