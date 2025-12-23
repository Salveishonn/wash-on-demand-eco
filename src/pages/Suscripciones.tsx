import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Check, 
  Car, 
  Sparkles, 
  Clock, 
  CreditCard, 
  Wallet,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENTS_ENABLED } from "@/config/payments";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  washes_per_month: number;
  is_active: boolean;
}

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

export default function Suscripciones() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "pay_later">(
    PAYMENTS_ENABLED ? "online" : "pay_later"
  );
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_cents", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los planes",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setIsCheckoutOpen(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        variant: "destructive",
        title: "Datos incompletos",
        description: "Por favor completá todos los campos",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const isPayLater = paymentMethod === "pay_later" || !PAYMENTS_ENABLED;

      console.log("[Suscripciones] Creating subscription, payLater:", isPayLater);

      const { data, error } = await supabase.functions.invoke("create-guest-subscription", {
        body: {
          planId: selectedPlan.id,
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          paymentMethod: isPayLater ? "pay_later" : "mercadopago",
        },
      });

      if (error) throw error;

      console.log("[Suscripciones] Subscription response:", data);

      if (isPayLater) {
        // Pay later - redirect to confirmation
        toast({
          title: "¡Solicitud recibida!",
          description: "Te contactaremos para activar tu suscripción.",
        });
        setIsCheckoutOpen(false);
        navigate(`/suscripcion-confirmada?status=pending&plan=${selectedPlan.name}`);
      } else if (data.initPoint) {
        // MercadoPago - redirect to payment
        toast({
          title: "Redirigiendo a MercadoPago...",
          description: "Serás redirigido para completar el pago.",
        });
        window.location.href = data.initPoint;
      } else {
        throw new Error("No se pudo obtener el link de pago");
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

  const planFeatures = {
    "Básico": [
      "2 lavados exteriores por mes",
      "Agendá cuando quieras",
      "Sin cargos extra",
      "Cancelá cuando quieras",
    ],
    "Premium": [
      "4 lavados exteriores por mes",
      "Prioridad de agenda",
      "Incluye aspirado interior",
      "Sin cargos extra",
      "Cancelá cuando quieras",
    ],
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display text-4xl md:text-5xl font-black text-background mb-4">
              Planes de <span className="text-primary">Suscripción</span>
            </h1>
            <p className="text-lg text-background/70">
              Ahorrá todos los meses y olvidate de coordinar cada lavado
            </p>
          </motion.div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay planes disponibles en este momento</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {plans.map((plan, index) => {
                const isPremium = plan.name === "Premium";
                const features = planFeatures[plan.name as keyof typeof planFeatures] || [];
                
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative rounded-2xl border-2 p-8 ${
                      isPremium 
                        ? "border-primary bg-primary/5" 
                        : "border-border bg-background"
                    }`}
                  >
                    {isPremium && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-4 py-1 bg-primary text-washero-charcoal text-sm font-bold rounded-full flex items-center gap-1">
                          <Sparkles className="w-4 h-4" /> Más Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center mb-6">
                      <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                        {plan.name}
                      </h2>
                      <p className="text-muted-foreground text-sm mb-4">
                        {plan.description}
                      </p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="font-display text-4xl font-black text-primary">
                          {formatPrice(plan.price_cents)}
                        </span>
                        <span className="text-muted-foreground">/mes</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-6 text-foreground">
                      <Car className="w-5 h-5 text-primary" />
                      <span className="font-semibold">
                        {plan.washes_per_month} lavados por mes
                      </span>
                    </div>

                    <ul className="space-y-3 mb-8">
                      {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      size="lg"
                      variant={isPremium ? "default" : "outline"}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      Suscribirme
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-center text-foreground mb-12">
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
              <p className="text-muted-foreground">
                Básico o Premium según tus necesidades
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                2. Reservá tus lavados
              </h3>
              <p className="text-muted-foreground">
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
              <p className="text-muted-foreground">
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
              Suscribite a {selectedPlan?.name}
            </DialogTitle>
            <DialogDescription>
              {formatPrice(selectedPlan?.price_cents || 0)}/mes - {selectedPlan?.washes_per_month} lavados
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="sub-name">Nombre completo</Label>
              <Input
                id="sub-name"
                placeholder="Juan Pérez"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sub-email">Email</Label>
              <Input
                id="sub-email"
                type="email"
                placeholder="juan@ejemplo.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sub-phone">Teléfono / WhatsApp</Label>
              <Input
                id="sub-phone"
                type="tel"
                placeholder="+54 11 1234-5678"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Payment Method */}
            <div className="pt-4 border-t border-border">
              <Label className="text-base font-semibold mb-3 block">
                Método de pago
              </Label>
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
                  Pagar {formatPrice(selectedPlan?.price_cents || 0)}
                </>
              ) : (
                "Enviar solicitud"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}