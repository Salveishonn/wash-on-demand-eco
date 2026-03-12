import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Loader2, User, Phone, Mail, CreditCard, Wallet, RefreshCw, Check, AlertCircle, MessageCircle, Sparkles, Armchair, Wind, Waves, Car, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { KipperOptIn } from "@/components/kipper/KipperOptIn";
import { AddressAutocomplete, PlaceSelection } from "./AddressAutocomplete";
import { formatDateKey } from "@/lib/dateUtils";
import { usePricing, formatPrice, type PricingItem } from "@/hooks/usePricing";
import { trackEvent } from "@/lib/gtag";
import { detectZoneFromAddress, isValidEmail, isValidArgentinaPhone, type ZoneDetectionResult } from "@/config/operativeZones";
import { useClusterPricing } from "@/hooks/useClusterPricing";

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

type PaymentMethod = "online" | "transfer" | "pay_later" | "subscription";

const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const iconMap: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-4 h-4" />,
  Armchair: <Armchair className="w-4 h-4" />,
  Wind: <Wind className="w-4 h-4" />,
  Waves: <Waves className="w-4 h-4" />,
};

function formatDateLong(date: Date): string {
  return `${DAYS_FULL[date.getDay()]} ${date.getDate()} de ${MONTHS_FULL[date.getMonth()]}`;
}

export function SlotModal({ date, preselectedTime, onClose, onBookingSuccess, bookingSource = "direct" }: SlotModalProps) {
  const { toast } = useToast();
  const { data: pricing, isLoading: isPricingLoading } = usePricing();
  
  const [step, setStep] = useState<"slots" | "form">(preselectedTime ? "form" : "slots");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(!preselectedTime);
  const [selectedTime, setSelectedTime] = useState<string | null>(preselectedTime || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    service: "",
    vehicleSize: "small",
    address: "",
    barrio: "",
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  // Selected extras
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  // Subscription state
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online");

  // Opt-ins
  const [kipperOptIn, setKipperOptIn] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);

  // Zone detection
  const [zoneResult, setZoneResult] = useState<ZoneDetectionResult | null>(null);
  const [showOutOfAreaModal, setShowOutOfAreaModal] = useState(false);

  // Cluster pricing
  const { clusterData, isLoading: isClusterLoading, fetchClusterPricing, reset: resetCluster } = useClusterPricing();
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Anti-bot: honeypot + timing
  const [honeypot, setHoneypot] = useState("");
  const formTimestamp = useRef(Date.now());

  // Set default service when pricing loads
  useEffect(() => {
    if (pricing?.services.length && !formData.service) {
      setFormData(prev => ({ ...prev, service: pricing.services[0].item_code }));
    }
  }, [pricing, formData.service]);

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
    // Clear field error on change
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    if (field === "email" || field === "phone") {
      setHasCheckedSubscription(false);
      setSubscriptionInfo(null);
      if (paymentMethod === "subscription") {
        setPaymentMethod("pay_later");
      }
    }
  };

  const handleAddressSelect = (selection: PlaceSelection) => {
    handleInputChange("address", selection.address);
    // Auto-detect zone from address
    const result = detectZoneFromAddress(selection.address);
    setZoneResult(result);
    if (result.zone) {
      setFormData((prev) => ({ ...prev, barrio: result.zone! }));
    }
    if (!result.isInOperativeArea) {
      setShowOutOfAreaModal(true);
    }
    // Store coordinates for cluster pricing
    if (selection.lat != null && selection.lng != null) {
      setAddressCoords({ lat: selection.lat, lng: selection.lng });
      const dateKey = formatDateKey(date);
      fetchClusterPricing(dateKey, selection.lat, selection.lng);
    }
  };

  const handleAddressTextChange = (text: string) => {
    handleInputChange("address", text);
    // Re-detect zone on text change (debounced by typing)
    const result = detectZoneFromAddress(text);
    setZoneResult(result);
    if (result.zone) {
      setFormData((prev) => ({ ...prev, barrio: result.zone! }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.email.trim() || !isValidEmail(formData.email)) {
      errors.email = "Ingresá un email válido";
    }
    if (!formData.phone.trim() || !isValidArgentinaPhone(formData.phone)) {
      errors.phone = "Ingresá un teléfono válido";
    }
    if (!formData.name.trim()) {
      errors.name = "Ingresá tu nombre";
    }
    if (!formData.address.trim()) {
      errors.address = "Ingresá una dirección";
    }
    // Check operative area
    if (formData.address.trim() && zoneResult && !zoneResult.isInOperativeArea) {
      errors.address = "Dirección fuera de nuestra zona operativa";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const toggleExtra = (code: string) => {
    setSelectedExtras(prev =>
      prev.includes(code) ? prev.filter(e => e !== code) : [...prev, code]
    );
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

  const getSelectedService = () => pricing?.services.find(s => s.item_code === formData.service);
  const getSelectedVehicleSize = () => pricing?.vehicleExtras.find(v => v.item_code === formData.vehicleSize);

  const getExtrasTotal = () => {
    if (!pricing) return 0;
    return selectedExtras.reduce((sum, code) => {
      const extra = pricing.extras.find(e => e.item_code === code);
      return sum + (extra?.price_ars || 0);
    }, 0);
  };

  const getTotalPrice = () => {
    const service = getSelectedService();
    const vehicleSize = getSelectedVehicleSize();
    if (!service) return 0;
    return service.price_ars + (vehicleSize?.price_ars || 0) + getExtrasTotal();
  };

  const getClusterDiscount = () => {
    if (!clusterData || clusterData.discountPercent <= 0) return 0;
    return Math.round(getTotalPrice() * clusterData.discountPercent / 100);
  };

  const getFinalPrice = () => {
    return getTotalPrice() - getClusterDiscount();
  };

  const canSubmit = () => {
    return (
      formData.service &&
      formData.vehicleSize &&
      formData.address.trim() &&
      formData.name.trim() &&
      formData.email.trim() &&
      formData.phone.trim() &&
      selectedTime &&
      (!zoneResult || zoneResult.isInOperativeArea)
    );
  };

  const handleSubmitWithValidation = async () => {
    if (!validateForm()) return;
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!canSubmit() || !pricing) return;

    setIsSubmitting(true);
    try {
      const service = getSelectedService();
      const vehicleSize = getSelectedVehicleSize();

      if (!service || !selectedTime) {
        throw new Error("Faltan datos requeridos");
      }

      const isSubscriptionBooking = paymentMethod === "subscription" && subscriptionInfo;
      const bookingPaymentMethod = isSubscriptionBooking ? "subscription" : paymentMethod;

      const extrasSnapshot = selectedExtras.map(code => {
        const extra = pricing.extras.find(e => e.item_code === code);
        return {
          code,
          name: extra?.display_name || code,
          price_ars: extra?.price_ars || 0,
        };
      });

      const { data: bookingResponse, error: bookingError } = await supabase.functions.invoke(
        "create-booking",
        {
          body: {
            customerName: formData.name.trim(),
            customerEmail: formData.email.trim(),
            customerPhone: formData.phone.trim(),
            serviceName: service.display_name,
            serviceCode: service.item_code,
            vehicleSize: vehicleSize?.item_code || "small",
            pricingVersionId: pricing.versionId,
            basePriceArs: service.price_ars,
            vehicleExtraArs: vehicleSize?.price_ars || 0,
            extrasTotalArs: getExtrasTotal(),
            totalPriceArs: getTotalPrice(),
            bookingDate: formatDateKey(date),
            bookingTime: selectedTime,
            address: formData.address.trim(),
            barrio: formData.barrio.trim() || undefined,
            latitude: addressCoords?.lat,
            longitude: addressCoords?.lng,
            notes: formData.notes.trim(),
            _hp: honeypot,
            _ts: formTimestamp.current,
            paymentMethod: bookingPaymentMethod,
            bookingType: isSubscriptionBooking ? "subscription" : "single",
            isSubscriptionBooking: !!isSubscriptionBooking,
            subscriptionId: isSubscriptionBooking ? subscriptionInfo.id : undefined,
            whatsappOptIn: whatsappOptIn,
            kipperOptIn: kipperOptIn,
            addons: extrasSnapshot,
            carType: vehicleSize?.display_name || "Auto chico",
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

      toast({
        title: "¡Reserva creada!",
        description: bookingResponse.message,
      });

      const createdBookingId = bookingResponse.bookingId || bookingResponse.booking?.id;

      trackEvent("booking_created", {
        value: getTotalPrice(),
        currency: "ARS",
      });

      // If online payment, create MercadoPago preference and redirect
      if (paymentMethod === "online" && createdBookingId) {
        toast({
          title: "Redirigiendo a MercadoPago...",
          description: "Te llevamos a la página de pago seguro",
        });

        try {
          const { data: mpData, error: mpError } = await supabase.functions.invoke(
            "create-mercadopago-preference",
            {
              body: {
                type: "booking",
                bookingId: createdBookingId,
              },
            }
          );

          if (mpError) throw mpError;

          if (mpData?.initPoint) {
            window.location.href = mpData.initPoint;
            return;
          } else {
            throw new Error("No se recibió el link de pago");
          }
        } catch (mpErr: any) {
          console.error("[SlotModal] MercadoPago preference error:", mpErr);
          toast({
            variant: "destructive",
            title: "Error al crear link de pago",
            description: "La reserva fue creada. Podés pagar después.",
          });
        }
      }

      onBookingSuccess(createdBookingId, bookingPaymentMethod);
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

  if (isPricingLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <div className="bg-card rounded-2xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      </motion.div>
    );
  }

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

          {step === "form" && pricing && (
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
                  {pricing.services.map((service) => (
                    <button
                      key={service.item_code}
                      type="button"
                      onClick={() => handleInputChange("service", service.item_code)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.service === service.item_code
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-foreground">{service.display_name}</span>
                          {service.metadata.duration_min && (
                            <span className="text-sm text-muted-foreground ml-2">({service.metadata.duration_min} min)</span>
                          )}
                        </div>
                        <span className="font-bold text-primary">{formatPrice(service.price_ars)}</span>
                      </div>
                      {service.metadata.description && (
                        <p className="text-sm text-muted-foreground mt-1">{service.metadata.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Size Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Tamaño del vehículo</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {pricing.vehicleExtras.map((size) => (
                    <button
                      key={size.item_code}
                      type="button"
                      onClick={() => handleInputChange("vehicleSize", size.item_code)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        formData.vehicleSize === size.item_code
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-medium text-foreground text-sm">{size.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {size.price_ars > 0 ? `+ ${formatPrice(size.price_ars)}` : "Sin cargo"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Extras Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Extras opcionales</Label>
                <div className="grid grid-cols-2 gap-2">
                  {pricing.extras.map((extra) => (
                    <button
                      key={extra.item_code}
                      type="button"
                      onClick={() => toggleExtra(extra.item_code)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedExtras.includes(extra.item_code)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-primary">
                          {iconMap[extra.metadata.icon || 'Sparkles'] || <Sparkles className="w-4 h-4" />}
                        </span>
                        {selectedExtras.includes(extra.item_code) && (
                          <Check className="w-4 h-4 text-primary ml-auto" />
                        )}
                      </div>
                      <span className="text-sm font-medium block">{extra.display_name}</span>
                      <span className="text-xs text-primary">{formatPrice(extra.price_ars)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Address with Google Places Autocomplete */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Dirección</Label>
                <AddressAutocomplete
                  key={step === "form" ? "form-open" : "form-closed"}
                  initialValue={formData.address}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  onTextChange={handleAddressTextChange}
                  onSelect={handleAddressSelect}
                />
                {fieldErrors.address && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.address}
                  </p>
                )}
                {zoneResult?.isInOperativeArea && zoneResult.zone && (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Zona detectada: {zoneResult.zone}
                  </p>
                )}
              </div>

              {/* Barrio / Zona (auto-filled, editable as fallback) */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Barrio / Zona</Label>
                <Input
                  placeholder="Se detecta automáticamente de la dirección"
                  value={formData.barrio}
                  onChange={(e) => handleInputChange("barrio", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Beneficio por zona: si 3+ autos de tu zona reservan el mismo día, todos reciben 30% OFF automáticamente
                </p>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Datos de contacto</Label>
                
                <div className="space-y-1">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Nombre completo"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className={`pl-10 ${fieldErrors.name ? "border-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Teléfono (ej: 11 2345-6789)"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className={`pl-10 ${fieldErrors.phone ? "border-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className={`pl-10 ${fieldErrors.email ? "border-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>

                <Textarea
                  placeholder="Notas adicionales (opcional)"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={2}
                />
              </div>

              {/* Opt-ins */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="whatsapp"
                    checked={whatsappOptIn}
                    onCheckedChange={(checked) => setWhatsappOptIn(checked === true)}
                  />
                  <label htmlFor="whatsapp" className="text-sm text-muted-foreground">
                    Recibir recordatorios por WhatsApp
                  </label>
                </div>

                <KipperOptIn
                  checked={kipperOptIn}
                  onCheckedChange={setKipperOptIn}
                />
              </div>

              {/* Subscription Info */}
              {subscriptionInfo && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">Suscripción activa</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {subscriptionInfo.planName} · {subscriptionInfo.washesRemaining} lavados restantes
                  </p>
                </div>
              )}

              {/* Payment Method */}
              {!subscriptionInfo && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Método de pago</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("online")}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "online"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === "online" ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="font-medium text-sm">MercadoPago</div>
                      <div className="text-xs text-muted-foreground">Online seguro</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("transfer")}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "transfer"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Wallet className={`w-5 h-5 mb-1 ${paymentMethod === "transfer" ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="font-medium text-sm">Transferencia</div>
                      <div className="text-xs text-muted-foreground">Te enviamos datos</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("pay_later")}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "pay_later"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Wallet className={`w-5 h-5 mb-1 ${paymentMethod === "pay_later" ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="font-medium text-sm">Pagar después</div>
                      <div className="text-xs text-muted-foreground">En el lugar</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Price Summary */}
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Servicio base</span>
                    <span>{formatPrice(getSelectedService()?.price_ars || 0)}</span>
                  </div>
                  {(getSelectedVehicleSize()?.price_ars || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extra vehículo</span>
                      <span>+{formatPrice(getSelectedVehicleSize()?.price_ars || 0)}</span>
                    </div>
                  )}
                  {getExtrasTotal() > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extras</span>
                      <span>+{formatPrice(getExtrasTotal())}</span>
                    </div>
                  )}
                  {getClusterDiscount() > 0 && (
                    <div className="flex justify-between text-accent">
                      <span className="flex items-center gap-1">
                        {clusterData?.emoji} Descuento por zona ({clusterData?.discountPercent}%)
                      </span>
                      <span>-{formatPrice(getClusterDiscount())}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">
                      {getClusterDiscount() > 0 ? (
                        <>
                          <span className="line-through text-muted-foreground text-sm mr-2">{formatPrice(getTotalPrice())}</span>
                          {formatPrice(getFinalPrice())}
                        </>
                      ) : (
                        formatPrice(getTotalPrice())
                      )}
                    </span>
                  </div>
                  {/* Cluster discount info */}
                  {clusterData && clusterData.nearbyCount > 0 ? (
                    <div className="mt-2 p-2 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-xs text-accent font-medium text-center">
                        {clusterData.emoji} {clusterData.label}: {clusterData.nearbyCount} reserva{clusterData.nearbyCount > 1 ? 's' : ''} cerca de tu zona este día.
                        {clusterData.discountPercent > 0 && ` ¡${clusterData.discountPercent}% OFF aplicado!`}
                      </p>
                    </div>
                  ) : isClusterLoading ? (
                    <div className="mt-2 p-2 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Calculando descuento por zona...
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-primary font-medium text-center">
                        🎉 Los primeros 30 lavados tienen 20% OFF automático.
                        {" "}Más reservas cerca = más descuento (hasta 20% OFF).
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmitWithValidation}
                disabled={!canSubmit() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : paymentMethod === "online" ? (
                  "Pagar con MercadoPago →"
                ) : (
                  "Confirmar reserva"
                )}
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Out of Area Modal */}
      <AnimatePresence>
        {showOutOfAreaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowOutOfAreaModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-background rounded-2xl shadow-xl border border-border p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center mx-auto">
                <MapPin className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground text-center">
                Todavía no operamos en esa zona
              </h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Por ahora Washero está disponible en <span className="font-semibold text-foreground">C.A.B.A. y Zona Norte</span> (desde Vicente López hasta Escobar).
                Si querés, dejanos tus datos y te avisamos cuando lleguemos a tu zona.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowOutOfAreaModal(false)}
                >
                  Entendido
                </Button>
                <Button
                  onClick={() => {
                    setShowOutOfAreaModal(false);
                    // Navigate to early access with out-of-area tag
                    window.open("/#early-access", "_blank");
                  }}
                  className="bg-primary text-primary-foreground"
                >
                  Avisarme cuando lleguen
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
