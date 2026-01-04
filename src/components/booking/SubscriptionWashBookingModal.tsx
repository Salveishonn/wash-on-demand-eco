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
import { resolvePlanId, formatPrice, getIncludedServiceForPlan, getIncludedVehicleSizeForPlan } from "@/config/services";

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
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Addons
  const { addons, selectedAddons, toggleAddon, isSelected, getAddonsTotal } = useServiceAddons();

  // Resolve plan from unified config
  const resolvedPlan = resolvePlanId(subscription.plan_id);
  const planName = resolvedPlan?.name || "Plan";
  const includedService = resolvedPlan ? getIncludedServiceForPlan(resolvedPlan.id) : null;
  const includedVehicleSize = resolvedPlan ? getIncludedVehicleSizeForPlan(resolvedPlan.id) : null;
  const washesPerMonth = resolvedPlan?.washesPerMonth || 2;
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
    if (!canSubmit || !selectedCar || !selectedAddress) return;

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

      // Use data from unified config
      const baseServiceName = includedService?.name || "Lavado Básico";
      const vehicleSizeName = includedVehicleSize?.name || "Auto Chico";

      const payload = {
        user_id: userId,
        customer_name: profile?.full_name || "Suscriptor",
        customer_email: profile?.email || "",
        customer_phone: profile?.phone || "",
        service_name: baseServiceName,
        service_price_cents: 0, // Subscription booking - no additional cost for base
        car_type: vehicleSizeName,
        car_type_extra_cents: 0, // Vehicle size included in subscription
        booking_date: bookingDate,
        booking_time: scheduledTime,
        address: getAddressDisplay(selectedAddress),
        notes: `Auto: ${getCarDisplay(selectedCar)} | Plan: ${planName}`,
        payment_method: "subscription",
        is_subscription_booking: true,
        subscription_id: activeSub.id,
        addons: selectedAddons as unknown as import("@/integrations/supabase/types").Json,
        addons_total_cents: getAddonsTotal(),
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
          {/* Plan Info Card - From unified config */}
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
                <span>Servicio: {includedService?.name || "Lavado Básico"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Vehículo: {includedVehicleSize?.name || "Auto Chico"} incluido</span>
              </div>
            </div>
          </div>

          {/* Date/Time Summary */}
          <div className="flex gap-4 p-4 bg-muted/30 rounded-xl">
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {format(scheduledDate, "EEE d MMM", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{scheduledTime} hs</span>
            </div>
          </div>

          {/* Car Selection - NO service/vehicle size selector */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              Seleccioná tu auto
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
                  <div className="font-medium text-foreground">{getCarDisplay(car)}</div>
                  {car.plate && (
                    <div className="text-sm text-muted-foreground">{car.plate}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Address Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Seleccioná la dirección
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
                  <div className="font-medium text-foreground">
                    {address.label || "Dirección"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getAddressDisplay(address)}
                    {address.neighborhood && ` · ${address.neighborhood}`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Extras (optional - paid) */}
          {addons.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Extras opcionales (con costo)</Label>
              <AddonsSelector
                addons={addons}
                selectedAddons={selectedAddons}
                onToggle={toggleAddon}
                isSelected={isSelected}
              />
            </div>
          )}

          {/* Total */}
          <div className="p-4 rounded-xl bg-washero-charcoal text-background">
            <div className="flex justify-between items-center">
              <span className="font-display text-lg font-bold">Total</span>
              <span className="font-display text-2xl font-black text-primary">
                {getAddonsTotal() > 0 ? formatPrice(getAddonsTotal()) : "Incluido en tu plan"}
              </span>
            </div>
            {getAddonsTotal() > 0 && (
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
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirmar lavado de mi plan
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
