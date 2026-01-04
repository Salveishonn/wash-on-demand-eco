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
import { SERVICES, VEHICLE_SIZES, formatPrice } from "@/config/services";

interface SlotInfo {
  time: string;
  status: "available" | "booked";
}

interface SlotModalProps {
  date: Date;
  preselectedTime?: string | null;
  onClose: () => void;
  onBookingSuccess: (bookingId: string, paymentMethod: string) => void;
  bookingSource?: string;
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

const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function formatDateLong(date: Date): string {
  return `${DAYS_FULL[date.getDay()]} ${date.getDate()} de ${MONTHS_FULL[date.getMonth()]}`;
}

export function SlotModal({ date, preselectedTime, onClose, onBookingSuccess, bookingSource = "direct" }: SlotModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"slots" | "form">(preselectedTime ? "form" : "slots");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(!preselectedTime);
  const [selectedTime, setSelectedTime] = useState<string | null>(preselectedTime || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    service: "",
    vehicleSize: "",
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

  useEffect(() => {
    if (formData.email && formData.phone && !hasCheckedSubscription && step === "form") {
      const timer = setTimeout(() => {
        checkSubscription();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.email, formData.phone, step, hasCheckedSubscription]);

  const getSelectedService = () => SERVICES.find(s => s.id === formData.service);
  const getSelectedVehicleSize = () => VEHICLE_SIZES.find(v => v.id === formData.vehicleSize);

  const getTotalPrice = () => {
    const service = getSelectedService();
    const vehicleSize = getSelectedVehicleSize();
    if (!service) return 0;
    return service.priceCents + (vehicleSize?.extraCents || 0) + getAddonsTotal();
  };

  const canSubmit = () => {
    return (
      formData.service &&
      formData.vehicleSize &&
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
      const vehicleSize = getSelectedVehicleSize();

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
            carType: vehicleSize?.name || "Auto Chico",
            carTypeExtraCents: vehicleSize?.extraCents || 0,
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
            bookingSource: bookingSource,
          },
        }
      );

      if (bookingError) {
        throw new Error(bookingError.message || "Error al crear la reserva");
      }

      if (bookingResponse?.slotTaken) {
        toast({
          variant: "destructive",
          title: "Horario no disponible",
          description: "Ese horario ya fue reservado. Elegí otro.",
        });
        await fetchSlots();
        setStep("slots");
        setSelectedTime(null);
        return;
      }

      if (bookingResponse?.error) {
        throw new Error(bookingResponse.message || bookingResponse.error);
      }

      if (kipperOptIn && bookingResponse?.booking?.id) {
        try {
          await supabase.functions.invoke("create-kipper-lead", {
            body: {
              customerName: formData.name,
              customerPhone: formData.phone,
              customerEmail: formData.email,
              vehicleType: vehicleSize?.name,
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

              {/* Service Selection - From unified config */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Servicio</Label>
                <div className="grid gap-2">
                  {SERVICES.map((service) => (
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
                          <span className="text-sm text-muted-foreground ml-2">({service.durationMinutes} min)</span>
                        </div>
                        <span className="font-bold text-primary">{formatPrice(service.priceCents)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Size Selection - From unified config */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Tamaño del vehículo</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {VEHICLE_SIZES.map((size) => (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => handleInputChange("vehicleSize", size.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        formData.vehicleSize === size.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-medium text-foreground text-sm">{size.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {size.extraCents > 0 ? `+ ${formatPrice(size.extraCents)}` : "Sin cargo"}
                      </div>
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

              {/* Contact Information */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Datos de contacto</Label>
                
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Nombre completo"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Teléfono (ej: 11 2345-6789)"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Notas (opcional)</Label>
                <Textarea
                  placeholder="Indicaciones especiales, color del auto, etc."
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={2}
                />
              </div>

              {/* WhatsApp opt-in */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                <input
                  type="checkbox"
                  id="whatsapp-optin"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="whatsapp-optin" className="text-sm text-muted-foreground cursor-pointer">
                  <MessageCircle className="w-4 h-4 inline mr-1 text-green-600" />
                  Quiero recibir confirmación y recordatorios por WhatsApp
                </label>
              </div>

              {/* Kipper Opt-in */}
              <KipperOptIn
                checked={kipperOptIn}
                onCheckedChange={setKipperOptIn}
              />

              {/* Subscription Check */}
              {isCheckingSubscription && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando suscripción...
                </div>
              )}

              {subscriptionInfo && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">{subscriptionInfo.planName}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {subscriptionInfo.washesRemaining} lavado(s) disponible(s) este período
                  </p>
                </div>
              )}

              {/* Payment Method */}
              {!subscriptionInfo && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Forma de pago</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("transfer")}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "transfer"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-primary mb-2" />
                      <div className="font-medium text-foreground text-sm">Transferencia</div>
                      <div className="text-xs text-muted-foreground">Pagar ahora</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("pay_later")}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "pay_later"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Wallet className="w-5 h-5 text-primary mb-2" />
                      <div className="font-medium text-foreground text-sm">Pagar después</div>
                      <div className="text-xs text-muted-foreground">Efectivo / MercadoPago</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="p-4 rounded-xl bg-washero-charcoal text-background">
                <div className="flex justify-between items-center">
                  <span className="font-display text-lg font-bold">Total</span>
                  <span className="font-display text-2xl font-black text-primary">
                    {paymentMethod === "subscription" && subscriptionInfo
                      ? getAddonsTotal() > 0
                        ? formatPrice(getAddonsTotal())
                        : "Incluido"
                      : formatPrice(getTotalPrice())
                    }
                  </span>
                </div>
                {paymentMethod === "subscription" && subscriptionInfo && getAddonsTotal() > 0 && (
                  <p className="text-sm text-background/70 mt-1">
                    Servicio base incluido · Extras: {formatPrice(getAddonsTotal())}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handleSubmit}
                disabled={!canSubmit() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Confirmar reserva
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
