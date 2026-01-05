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
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENTS_ENABLED } from "@/config/payments";
import { KipperSubscriptionBanner } from "@/components/kipper/KipperSubscriptionBanner";
import { usePricing, formatPrice, getPlanByCode } from "@/hooks/usePricing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsCheckingAuth(false);

      // Auto-select plan from URL
      const planId = searchParams.get("plan");
      if (planId && session?.user) {
        setSelectedPlan(planId);
        setIsCheckoutOpen(true);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      const isPayLater = paymentMethod === "pay_later" || !PAYMENTS_ENABLED;

      // Create subscription in canonical `subscriptions` table ONLY
      const { data: subscription, error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          plan_id: "00000000-0000-0000-0000-000000000001", // Default plan ref
          plan_code: plan.item_code,
          included_service: plan.metadata.included_service,
          included_vehicle_size: plan.metadata.included_vehicle_size,
          washes_remaining: plan.metadata.washes_per_month || 0,
          status: isPayLater ? "pending" : "active",
          pricing_version_id: pricing.versionId,
          customer_name: user.user_metadata?.full_name || user.email || null,
          customer_email: user.email || null,
          customer_phone: user.user_metadata?.phone || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (isPayLater) {
        toast({
          title: "¡Solicitud recibida!",
          description: "Te contactaremos para activar tu suscripción.",
        });
        setIsCheckoutOpen(false);
        navigate(`/suscripcion-confirmada?status=pending&plan=${plan.display_name}`);
      } else {
        toast({
          title: "¡Suscripción creada!",
          description: "Podés ver tu plan en el dashboard.",
        });
        setIsCheckoutOpen(false);
        navigate("/dashboard");
      }
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

  return (
    <Layout>
      {/* Hero */}
      <section className="py-12 md:py-16 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display text-4xl md:text-5xl font-black text-background mb-4">
              Planes <span className="text-primary">Mensuales</span>
            </h1>
            <p className="text-lg text-background/80">
              Mantené tu auto siempre impecable con un plan a tu medida
            </p>
          </motion.div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricing?.plans.map((plan, index) => {
              const isPopular = plan.item_code === "confort";
              const washesPerMonth = plan.metadata.washes_per_month || 0;
              const includedService = plan.metadata.included_service;
              const includedVehicle = plan.metadata.included_vehicle_size;

              return (
                <motion.div
                  key={plan.item_code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative rounded-2xl border-2 p-6 md:p-8 ${
                    isPopular 
                      ? "border-primary bg-primary/5 shadow-gold md:scale-105 z-10" 
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 bg-primary text-washero-charcoal text-sm font-bold rounded-full flex items-center gap-1 whitespace-nowrap">
                        <Star className="w-3 h-3" /> Más elegido
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-6 mt-2">
                    <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-4">
                      {plan.display_name}
                    </h2>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-display text-3xl md:text-4xl font-black text-primary">
                        {formatPrice(plan.price_ars)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mes</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">
                        {washesPerMonth} lavado{washesPerMonth !== 1 ? 's' : ''} por mes
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">
                        Servicio: {includedService === 'basic' ? 'Lavado Básico' : 'Lavado Completo'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">
                        Vehículo: {includedVehicle === 'small' ? 'Auto chico' : includedVehicle === 'suv' ? 'SUV' : 'Pick Up'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">Sin cargos extra</span>
                    </li>
                  </ul>

                  <Button
                    className="w-full"
                    size="lg"
                    variant={isPopular ? "hero" : "outline"}
                    onClick={() => handleSelectPlan(plan.item_code)}
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
                </motion.div>
              );
            })}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center text-sm text-muted-foreground mt-8 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 text-washero-eco" />
            Los planes se abonan por adelantado
          </motion.p>

          <div className="mt-12 max-w-4xl mx-auto">
            <KipperSubscriptionBanner />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
            ¿Cómo funciona?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                1. Elegí tu plan
              </h3>
              <p className="text-muted-foreground text-sm">
                Básico, Confort o Premium según tus necesidades
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                2. Reservá tus lavados
              </h3>
              <p className="text-muted-foreground text-sm">
                Usá tus lavados cuando quieras durante el mes
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                3. Disfrutá el ahorro
              </h3>
              <p className="text-muted-foreground text-sm">
                Tu cuota se renueva automáticamente cada mes
              </p>
            </div>
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
              {selectedPlanData && formatPrice(selectedPlanData.price_ars)}/mes - {selectedPlanData?.metadata.washes_per_month} lavados
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-xl">
              <p className="text-sm text-muted-foreground">
                Suscribiéndote como:
              </p>
              <p className="font-medium text-foreground">
                {user?.email}
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-base font-semibold mb-3 block">
                Método de pago
              </p>
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
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsCheckoutOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubscribe}
              disabled={isSubmitting}
            >
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
