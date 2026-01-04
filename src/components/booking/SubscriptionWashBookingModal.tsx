import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Car, MapPin, Sparkles, Calendar, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddonsSelector } from "./AddonsSelector";
import { useServiceAddons } from "@/hooks/useServiceAddons";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePricing, formatPrice, getPlanByCode, getServiceByCode, getVehicleExtraByCode } from "@/hooks/usePricing";

interface UserCar {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  plate: string | null;
}

interface UserAddress {
  id: string;
  label: string | null;
  line1: string;
  neighborhood: string | null;
  city: string | null;
}

interface SubscriptionInfo {
  id: string;
  plan_id: string;
  status: string;
  washes_remaining: number | null;
  washes_used_this_month: number | null;
}

interface SubscriptionWashBookingModalProps {
  scheduledDate: Date;
  scheduledTime: string;
  subscription: SubscriptionInfo;
  cars: UserCar[];
  addresses: UserAddress[];
  userId: string;
  onClose: () => void;
  onBookingSuccess: () => void;
  onNeedsCar: () => void;
  onNeedsAddress: () => void;
}

export function SubscriptionWashBookingModal({
  scheduledDate,
  scheduledTime,
  subscription,
  cars,
  addresses,
  userId,
  onClose,
  onBookingSuccess,
  onNeedsCar,
  onNeedsAddress,
}: SubscriptionWashBookingModalProps) {
  const { toast } = useToast();
  const { data: pricing, isLoading: isPricingLoading } = usePricing();
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Addons
  const { addons, selectedAddons, toggleAddon, isSelected, getAddonsTotal } = useServiceAddons();

  // Resolve plan from pricing
  const plan = pricing ? getPlanByCode(pricing, subscription.plan_id) : null;
  const planName = plan?.display_name || "Plan";
  const includedService = plan?.metadata.included_service 
    ? getServiceByCode(pricing, plan.metadata.included_service) 
    : null;
  const includedVehicleSize = plan?.metadata.included_vehicle_size
    ? getVehicleExtraByCode(pricing, plan.metadata.included_vehicle_size)
    : null;
  const washesPerMonth = plan?.metadata.washes_per_month || 2;
  const washesRemaining = subscription.washes_remaining ?? washesPerMonth;

  // Auto-select default car/address if only one exists
  useEffect(() => {
    if (cars.length === 1) {
      setSelectedCarId(cars[0].id);
    }
    if (addresses.length === 1) {
      setSelectedAddressId(addresses[0].id);
    }
  }, [cars, addresses]);

  // Check if user has cars
  if (cars.length === 0) {
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
          className="w-full max-w-md bg-background rounded-2xl shadow-xl border border-border p-6 text-center"
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="font-display text-xl font-bold mb-2">Agregá un auto primero</h2>
          <p className="text-muted-foreground mb-6">
            Para agendar un lavado de tu plan, necesitás tener al menos un auto registrado.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onNeedsCar}>
              <Car className="w-4 h-4 mr-2" />
              Agregar auto
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Check if user has addresses
  if (addresses.length === 0) {
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
          className="w-full max-w-md bg-background rounded-2xl shadow-xl border border-border p-6 text-center"
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="font-display text-xl font-bold mb-2">Agregá una dirección primero</h2>
          <p className="text-muted-foreground mb-6">
            Para agendar un lavado de tu plan, necesitás tener al menos una dirección registrada.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onNeedsAddress}>
              <MapPin className="w-4 h-4 mr-2" />
              Agregar dirección
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Check subscription status
  if (subscription.status === "paused") {
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
          className="w-full max-w-md bg-background rounded-2xl shadow-xl border border-border p-6 text-center"
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="font-display text-xl font-bold mb-2">Suscripción pausada</h2>
          <p className="text-muted-foreground mb-6">
            Tu suscripción está pausada. Reactivala para poder agendar lavados de tu plan.
          </p>
          <Button onClick={onClose}>Entendido</Button>
        </motion.div>
      </motion.div>
    );
  }

  if (subscription.status !== "active" && subscription.status !== "pending") {
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
          className="w-full max-w-md bg-background rounded-2xl shadow-xl border border-border p-6 text-center"
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="font-display text-xl font-bold mb-2">Suscripción no activa</h2>
          <p className="text-muted-foreground mb-6">
            Tu suscripción no está activa. Contactanos para más información.
          </p>
          <Button onClick={onClose}>Entendido</Button>
        </motion.div>
      </motion.div>
    );
  }

  if (washesRemaining <= 0) {
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
          className="w-full max-w-md bg-background rounded-2xl shadow-xl border border-border p-6 text-center"
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="font-display text-xl font-bold mb-2">Sin lavados disponibles</h2>
          <p className="text-muted-foreground mb-6">
            No tenés lavados disponibles este mes. Tu cuota se renovará en el próximo período.
          </p>
          <Button onClick={onClose}>Entendido</Button>
        </motion.div>
      </motion.div>
    );
  }

  if (isPricingLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      >
        <div className="bg-card rounded-2xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      </motion.div>
    );
  }

  const selectedCar = cars.find((c) => c.id === selectedCarId);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const canSubmit = selectedCarId && selectedAddressId;

  const getCarDisplay = (car: UserCar) => {
    const parts = [car.nickname, car.brand, car.model].filter(Boolean);
    return parts.length > 0 ? parts.join(" - ") : "Auto sin nombre";
  };

  const getAddressDisplay = (address: UserAddress) => {
    return address.line1 || address.label || "Dirección sin nombre";
  };

  type ActiveSubscriptionRow = {
    id: string;
    user_id: string | null;
    status: string;
    plan_id: string;
    washes_remaining: number;
    washes_used_in_cycle: number;
  };

  const getOrCreateActiveSubscriptionForBooking = async (
    profile?: { full_name: string | null; email: string | null; phone: string | null } | null
  ): Promise<ActiveSubscriptionRow | null> => {
    const { data: existing, error: existingError } = await supabase
      .from("subscriptions")
      .select("id, user_id, status, plan_id, washes_remaining, washes_used_in_cycle")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing as ActiveSubscriptionRow;

    // No FK-target subscription found. Create one based on the plan.
    const { data: planRow, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, washes_per_month")
      .eq("name", planName)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError) throw planError;
    if (!planRow) return null;

    const { data: created, error: createError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: planRow.id,
        plan_code: subscription.plan_id,
        included_service: plan?.metadata.included_service || "basic",
        included_vehicle_size: plan?.metadata.included_vehicle_size || "small",
        pricing_version_id: pricing?.versionId || null,
        status: "active",
        washes_remaining: planRow.washes_per_month,
        washes_used_in_cycle: 0,
        customer_name: profile?.full_name ?? null,
        customer_email: profile?.email ?? null,
        customer_phone: profile?.phone ?? null,
      })
      .select("id, user_id, status, plan_id, washes_remaining, washes_used_in_cycle")
      .single();

    if (createError) throw createError;
    return created as ActiveSubscriptionRow;
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCar || !selectedAddress || !pricing) return;

    setIsSubmitting(true);
    try {
      // Get user profile for customer info
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", userId)
        .maybeSingle();

      // Ensure we reference the FK target table (subscriptions.id)
      const activeSub = await getOrCreateActiveSubscriptionForBooking(profile);
      console.log("[SubscriptionWashBookingModal] activeSub:", activeSub);

      if (!activeSub) {
        toast({
          variant: "destructive",
          title: "No tenés una suscripción activa",
          description: "Elegí un plan para poder agendar lavados desde tu cuenta.",
        });
        return;
      }

      // Format the date for booking
      const bookingDate = format(scheduledDate, "yyyy-MM-dd");

      // Subscription bookings: base is prepaid. Extras may require payment.
      const paymentStatus = (getAddonsTotal() > 0 ? "pending" : "approved") as "pending" | "approved";

      // Use data from dynamic pricing
      const baseServiceName = includedService?.display_name || "Lavado Básico";
      const vehicleSizeName = includedVehicleSize?.display_name || "Auto chico";

      const payload = {
        user_id: userId,
        customer_name: profile?.full_name || "Suscriptor",
        customer_email: profile?.email || "",
        customer_phone: profile?.phone || "",
        service_name: baseServiceName,
        service_code: plan?.metadata.included_service || "basic",
        vehicle_size: plan?.metadata.included_vehicle_size || "small",
        pricing_version_id: pricing.versionId,
        service_price_cents: 0, // Subscription booking - no additional cost for base
        car_type: vehicleSizeName,
        car_type_extra_cents: 0, // Vehicle size included in subscription
        booking_date: bookingDate,
        booking_time: scheduledTime,
        address: getAddressDisplay(selectedAddress),
        notes: `Auto: ${getCarDisplay(selectedCar)} | Plan: ${planName}`,
        payment_method: "subscription",
        booking_type: "subscription" as const,
        is_subscription_booking: true,
        subscription_id: activeSub.id,
        addons: selectedAddons as unknown as import("@/integrations/supabase/types").Json,
        addons_total_cents: getAddonsTotal(),
        base_price_ars: 0,
        vehicle_extra_ars: 0,
        extras_total_ars: Math.round(getAddonsTotal() / 100),
        total_price_ars: Math.round(getAddonsTotal() / 100),
        payment_status: paymentStatus,
        status: "pending" as const,
        booking_source: "subscription",
      };

      console.log("[SubscriptionWashBookingModal] booking payload:", payload);

      const { error: bookingError } = await supabase.from("bookings").insert([payload]);
      if (bookingError) throw bookingError;

      // Update usage on `subscriptions` (FK table)
      const nextRemaining = Math.max((activeSub.washes_remaining ?? 0) - 1, 0);
      const nextUsed = (activeSub.washes_used_in_cycle ?? 0) + 1;

      const { error: usageError } = await supabase
        .from("subscriptions")
        .update({ washes_remaining: nextRemaining, washes_used_in_cycle: nextUsed })
        .eq("id", activeSub.id);

      if (usageError) {
        console.error("[SubscriptionWashBookingModal] Failed to update subscriptions usage:", usageError);
      }

      // Update subscription usage (dashboard table)
      const newUsed = (subscription.washes_used_this_month || 0) + 1;
      const newRemaining = Math.max((subscription.washes_remaining ?? washesPerMonth) - 1, 0);

      const { error: updateError } = await supabase
        .from("user_managed_subscriptions")
        .update({
          washes_used_this_month: newUsed,
          washes_remaining: newRemaining,
        })
        .eq("id", subscription.id);

      if (updateError) {
        console.error("Failed to update subscription usage:", updateError);
      }

      toast({
        title: "¡Lavado agendado!",
        description: `Tu lavado de ${planName} fue programado para el ${format(scheduledDate, "EEEE d 'de' MMMM", { locale: es })} a las ${scheduledTime} hs.`,
      });

      onBookingSuccess();
    } catch (error: any) {
      console.error("[SubscriptionWashBookingModal] Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo agendar el lavado",
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
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Agendar lavado de mi plan
            </h2>
            <p className="text-sm text-muted-foreground">
              {format(scheduledDate, "EEEE d 'de' MMMM", { locale: es })} · {scheduledTime} hs
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Plan Info Card */}
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-bold text-foreground">{planName}</span>
              <span className="text-sm text-primary font-medium">
                {washesRemaining} lavado{washesRemaining !== 1 ? "s" : ""} restante{washesRemaining !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Servicio: {includedService?.display_name || "Lavado Básico"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Vehículo: {includedVehicleSize?.display_name || "Auto chico"} incluido</span>
              </div>
            </div>
          </div>

          {/* Date/Time Summary */}
          <div className="flex gap-4 p-4 bg-muted/30 rounded-xl">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">{format(scheduledDate, "d MMM", { locale: es })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">{scheduledTime} hs</span>
            </div>
          </div>

          {/* Car Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">
              <Car className="w-4 h-4 inline mr-2" />
              ¿Qué auto lavamos?
            </Label>
            <div className="grid gap-2">
              {cars.map((car) => (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => setSelectedCarId(car.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedCarId === car.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <span className="font-medium text-foreground block">{getCarDisplay(car)}</span>
                      {car.plate && (
                        <span className="text-sm text-muted-foreground">{car.plate}</span>
                      )}
                    </div>
                    {selectedCarId === car.id && (
                      <CheckCircle className="w-5 h-5 text-primary ml-auto" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Address Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">
              <MapPin className="w-4 h-4 inline mr-2" />
              ¿Dónde lo lavamos?
            </Label>
            <div className="grid gap-2">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => setSelectedAddressId(address.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedAddressId === address.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      {address.label && (
                        <span className="text-sm text-primary font-medium block">{address.label}</span>
                      )}
                      <span className="font-medium text-foreground block truncate">{address.line1}</span>
                      {address.neighborhood && (
                        <span className="text-sm text-muted-foreground">{address.neighborhood}</span>
                      )}
                    </div>
                    {selectedAddressId === address.id && (
                      <CheckCircle className="w-5 h-5 text-primary ml-auto flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Extras */}
          <div>
            <Label className="text-base font-semibold mb-3 block">
              <Sparkles className="w-4 h-4 inline mr-2" />
              Extras opcionales (con costo adicional)
            </Label>
            <AddonsSelector
              addons={addons}
              selectedAddons={selectedAddons}
              onToggle={toggleAddon}
              isSelected={isSelected}
            />
            {getAddonsTotal() > 0 && (
              <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total extras:</span>
                  <span className="font-bold text-primary">{formatPrice(getAddonsTotal() / 100)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Los extras se abonan aparte del plan
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border p-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar lavado
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
