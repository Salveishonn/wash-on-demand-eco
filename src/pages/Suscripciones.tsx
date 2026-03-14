import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  Check,
  Sparkles,
  Clock,
  CreditCard,
  Wallet,
  Loader2,
  Star,
  ChevronRight,
  Shield,
  CalendarCheck,
  RefreshCw,
  Pause,
  Users,
  Building2,
  Car,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENTS_ENABLED } from "@/config/payments";
import { KipperSubscriptionBanner } from "@/components/kipper/KipperSubscriptionBanner";
import { usePricing, formatPrice, getPlanByCode } from "@/hooks/usePricing";
import { trackEvent } from "@/lib/gtag";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Single-wash reference prices for savings calculation
const SINGLE_WASH_PRICES: Record<string, number> = {
  basic: 30000,
  complete: 38000,
};

const PLAN_COPY: Record<string, { tagline: string; idealFor: string; icon: any }> = {
  esencial: {
    tagline: "Mantené tu auto prolijo todo el mes.",
    idealFor: "Uso individual",
    icon: Car,
  },
  confort: {
    tagline: "La forma más cómoda de tener tu auto impecable.",
    idealFor: "Uso frecuente",
    icon: Star,
  },
  pro: {
    tagline: "Cuidado premium para un nivel superior.",
    idealFor: "Cuidado premium",
    icon: Sparkles,
  },
  familia: {
    tagline: "Un solo plan para los autos de tu casa.",
    idealFor: "Familias",
    icon: Users,
  },
  flota: {
    tagline: "La solución para empresas con varios vehículos.",
    idealFor: "Empresas y flotas",
    icon: Building2,
  },
};

function getSavings(plan: any): { monthly: number; percent: number } {
  const washes = plan.metadata?.washes_per_month || 0;
  const serviceKey = plan.metadata?.included_service || "basic";
  const singlePrice = SINGLE_WASH_PRICES[serviceKey] || 30000;
  const withoutPlan = singlePrice * washes;
  const monthly = withoutPlan - plan.price_ars;
  const percent = withoutPlan > 0 ? Math.round((monthly / withoutPlan) * 100) : 0;
  return { monthly: Math.max(0, monthly), percent: Math.max(0, percent) };
}

function PlanCard({ plan, index, onSelect, isCheckingAuth }: {
  plan: any;
  index: number;
  onSelect: (code: string) => void;
  isCheckingAuth: boolean;
}) {
  const isPopular = plan.item_code === "confort";
  const isShared = plan.metadata?.shared_usage === true;
  const maxVehicles = plan.metadata?.max_vehicles || 1;
  const washes = plan.metadata?.washes_per_month || 0;
  const serviceLabel = plan.metadata?.included_service === "complete" ? "Lavado Completo" : "Lavado Básico";
  const savings = getSavings(plan);
  const copy = PLAN_COPY[plan.item_code] || { tagline: "", idealFor: "", icon: Car };
  const IconComp = copy.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`relative rounded-2xl border-2 flex flex-col ${
        isPopular
          ? "border-primary bg-primary/5 shadow-gold md:scale-[1.02] z-10"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 bg-primary text-washero-charcoal text-xs font-bold rounded-full flex items-center gap-1 whitespace-nowrap">
            <Star className="w-3 h-3" /> Más elegido
          </span>
        </div>
      )}

      <div className="p-5 md:p-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center mb-4 mt-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <IconComp className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-display text-lg md:text-xl font-bold text-foreground mb-0.5">
            {plan.display_name}
          </h2>
          <p className="text-xs text-muted-foreground">{copy.idealFor}</p>
        </div>

        {/* Price */}
        <div className="text-center mb-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="font-display text-3xl md:text-4xl font-black text-primary">
              {formatPrice(plan.price_ars)}
            </span>
            <span className="text-muted-foreground text-sm">/mes</span>
          </div>
          {savings.monthly > 0 && (
            <p className="text-xs text-washero-eco font-semibold mt-1">
              Ahorrás {formatPrice(savings.monthly)}/mes ({savings.percent}%)
            </p>
          )}
        </div>

        {/* Tagline */}
        <p className="text-sm text-muted-foreground text-center mb-4 leading-relaxed">
          {copy.tagline}
        </p>

        {/* Features */}
        <ul className="space-y-2 mb-5 flex-1">
          <li className="flex items-start gap-2.5">
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">
              {washes} lavado{washes !== 1 ? "s" : ""}/mes — {serviceLabel}
            </span>
          </li>
          {isShared ? (
            <li className="flex items-start gap-2.5">
              <Users className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">
                Hasta {maxVehicles} vehículos · uso compartido
              </span>
            </li>
          ) : (
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">1 vehículo incluido</span>
            </li>
          )}
          <li className="flex items-start gap-2.5">
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">Reprogramación flexible</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">Podés pausar tu plan</span>
          </li>
        </ul>

        <Button
          className="w-full"
          size="lg"
          variant={isPopular ? "hero" : "outline"}
          onClick={() => onSelect(plan.item_code)}
          disabled={isCheckingAuth}
        >
          {isCheckingAuth ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Suscribirme
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

export default function Suscripciones() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { data: pricing, isLoading: isPricingLoading } = usePricing();

  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "pay_later">(
    PAYMENTS_ENABLED ? "online" : "pay_later"
  );

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsCheckingAuth(false);
      const planId = searchParams.get("plan");
      if (planId && session?.user) {
        setSelectedPlan(planId);
        setIsCheckoutOpen(true);
      }
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, [searchParams]);

  const handleSelectPlan = (planCode: string) => {
    if (!user) {
      navigate(`/auth?redirect=/suscripciones&plan=${planCode}`);
      return;
    }
    setSelectedPlan(planCode);
    setIsCheckoutOpen(true);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan || !user || !pricing) return;
    const plan = getPlanByCode(pricing, selectedPlan);
    if (!plan) return;
    setIsSubmitting(true);
    try {
      // Map plan codes to subscription_plans names
      const planNameMap: Record<string, string> = {
        esencial: "Plan Esencial",
        basic: "Plan Esencial",
        confort: "Plan Confort",
        pro: "Plan Pro",
        premium: "Plan Pro",
        familia: "Plan Familia",
        flota: "Plan Flota",
      };
      const planNameToSearch = planNameMap[selectedPlan.toLowerCase()] || `Plan ${selectedPlan}`;
      const { data: planRow, error: planError } = await supabase
        .from("subscription_plans")
        .select("id, washes_per_month, name, plan_type, max_vehicles, shared_usage")
        .eq("name", planNameToSearch)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (planError) throw planError;
      const planIdToUse = planRow?.id;
      if (!planIdToUse) {
        throw new Error("No se encontró el plan seleccionado. Intenta nuevamente.");
      }
      const { error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          plan_id: planIdToUse,
          plan_code: plan.item_code,
          included_service: plan.metadata.included_service,
          included_vehicle_size: plan.metadata.included_vehicle_size,
          plan_type: plan.metadata.plan_type || "individual",
          max_vehicles: plan.metadata.max_vehicles || 1,
          shared_usage: plan.metadata.shared_usage || false,
          washes_remaining: 0,
          washes_used_in_cycle: 0,
          status: "pending",
          pricing_version_id: pricing.versionId,
          customer_name: user.user_metadata?.full_name || user.email || null,
          customer_email: user.email || null,
          customer_phone: user.user_metadata?.phone || null,
        })
        .select()
        .single();
      if (error) throw error;
      trackEvent("subscription_created", { value: plan.price_ars, currency: "ARS" });
      toast({
        title: "¡Solicitud enviada!",
        description: "Tu suscripción está pendiente de aprobación. Te contactaremos pronto.",
      });
      setIsCheckoutOpen(false);
      navigate(`/suscripcion-confirmada?status=pending&plan=${encodeURIComponent(plan.display_name)}`);
    } catch (error: any) {
      console.error("[Suscripciones] Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo procesar la suscripción",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlanData = pricing && selectedPlan ? getPlanByCode(pricing, selectedPlan) : null;

  if (isPricingLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Split plans into individual and shared for layout
  const individualPlans = pricing?.plans.filter(p => !p.metadata?.shared_usage) || [];
  const sharedPlans = pricing?.plans.filter(p => p.metadata?.shared_usage) || [];

  return (
    <Layout>
      {/* Hero */}
      <section className="py-10 md:py-16 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display text-3xl md:text-5xl font-black text-background mb-3">
              Tu auto siempre <span className="text-primary">impecable</span>
            </h1>
            <p className="text-base md:text-lg text-background/80 max-w-xl mx-auto">
              Elegí un plan mensual y ahorrá en cada lavado. Reprogramá cuando quieras, pausá si lo necesitás.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Individual Plans */}
      <section className="py-10 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-xl md:text-2xl font-bold text-center text-foreground mb-2">
            Planes individuales
          </h2>
          <p className="text-center text-sm text-muted-foreground mb-8">Para tu uso personal</p>

          <div className="grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
            {individualPlans.map((plan, index) => (
              <PlanCard
                key={plan.item_code}
                plan={plan}
                index={index}
                onSelect={handleSelectPlan}
                isCheckingAuth={isCheckingAuth}
              />
            ))}
          </div>

          {/* Shared Plans */}
          {sharedPlans.length > 0 && (
            <>
              <div className="mt-14 mb-8 text-center">
                <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-2">
                  Planes compartidos
                </h2>
                <p className="text-sm text-muted-foreground">Para familias, hogares y empresas con varios vehículos</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 max-w-3xl mx-auto">
                {sharedPlans.map((plan, index) => (
                  <PlanCard
                    key={plan.item_code}
                    plan={plan}
                    index={index + individualPlans.length}
                    onSelect={handleSelectPlan}
                    isCheckingAuth={isCheckingAuth}
                  />
                ))}
              </div>
            </>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center text-sm text-muted-foreground mt-8 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4 text-washero-eco" />
            Sin compromiso. Cancelá cuando quieras.
          </motion.p>

          <div className="mt-10 max-w-4xl mx-auto">
            <KipperSubscriptionBanner />
          </div>
        </div>
      </section>

      {/* Benefits / How it works */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            ¿Cómo funciona?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { icon: CreditCard, title: "Elegí tu plan", desc: "Individual, Familia o Flota" },
              { icon: CalendarCheck, title: "Agendá tus lavados", desc: "Elegí el día y horario" },
              { icon: RefreshCw, title: "Reprogramá gratis", desc: "Cambio de fecha sin costo" },
              { icon: Pause, title: "Pausá si querés", desc: "Retomá cuando estés listo" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className="text-center"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-sm md:text-base font-bold text-foreground mb-1">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-xs md:text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Confirmar {selectedPlanData?.display_name}
            </DialogTitle>
            <DialogDescription>
              {selectedPlanData && formatPrice(selectedPlanData.price_ars)}/mes — {selectedPlanData?.metadata.washes_per_month} lavados incluidos
              {selectedPlanData?.metadata.shared_usage && ` · Hasta ${selectedPlanData.metadata.max_vehicles} vehículos`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-xl">
              <p className="text-sm text-muted-foreground">Suscribiéndote como:</p>
              <p className="font-medium text-foreground">{user?.email}</p>
            </div>

            {selectedPlanData?.metadata.shared_usage && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Plan compartido
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Los lavados se comparten entre hasta {selectedPlanData.metadata.max_vehicles} vehículos registrados. Podés agregarlos desde tu panel.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <p className="text-base font-semibold mb-3">Método de pago</p>
              <div className="space-y-3">
                {PAYMENTS_ENABLED && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online")}
                    className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                      paymentMethod === "online"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <CreditCard className={`w-5 h-5 ${paymentMethod === "online" ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="text-left">
                      <span className="font-medium text-foreground block">Pagar con MercadoPago</span>
                      <span className="text-sm text-muted-foreground">Débito automático mensual</span>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pay_later")}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                    paymentMethod === "pay_later"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Wallet className={`w-5 h-5 ${paymentMethod === "pay_later" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left">
                    <span className="font-medium text-foreground block">Solicitar suscripción</span>
                    <span className="text-sm text-muted-foreground">Te contactamos para coordinar el pago</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsCheckoutOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSubscribe} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : paymentMethod === "online" ? (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pagar {selectedPlanData && formatPrice(selectedPlanData.price_ars)}
                </>
              ) : (
                "Confirmar suscripción"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
