import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Star, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";

interface Plan {
  code: string;
  name: string;
  washes: number;
  price: number;
  popular?: boolean;
  icon: React.ReactNode;
  features: string[];
}

const PLANS: Plan[] = [
  {
    code: "BASIC_2",
    name: "Básico",
    washes: 2,
    price: 25000,
    icon: <Sparkles className="w-6 h-6" />,
    features: [
      "2 lavados por mes",
      "Lavado exterior completo",
      "Agenda flexible",
      "WhatsApp para coordinar",
    ],
  },
  {
    code: "PRO_4",
    name: "Pro",
    washes: 4,
    price: 45000,
    popular: true,
    icon: <Star className="w-6 h-6" />,
    features: [
      "4 lavados por mes",
      "Exterior + interior",
      "Prioridad de agenda",
      "WhatsApp directo",
      "Sin recargo por SUV",
    ],
  },
  {
    code: "ULTRA_8",
    name: "Ultra",
    washes: 8,
    price: 80000,
    icon: <Crown className="w-6 h-6" />,
    features: [
      "8 lavados por mes",
      "Servicio completo premium",
      "Agenda prioritaria",
      "WhatsApp VIP",
      "Sin recargo por SUV",
      "Productos premium",
    ],
  },
];

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(cents);
};

export default function Planes() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const normalizePhone = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("549")) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith("54")) {
      const afterCode = cleaned.slice(2);
      if (!afterCode.startsWith("9")) {
        return `+549${afterCode}`;
      }
      return `+${cleaned}`;
    }
    if (cleaned.startsWith("15")) {
      return `+5491${cleaned.slice(2)}`;
    }
    if (cleaned.startsWith("11")) {
      return `+549${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `+549${cleaned}`;
    }
    return `+${cleaned}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    if (!formData.name || !formData.phone || !formData.address) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completá nombre, teléfono y dirección.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const phone = normalizePhone(formData.phone);

      const { data, error } = await supabase.functions.invoke(
        "create-user-subscription",
        {
          body: {
            name: formData.name,
            phone,
            email: formData.email || null,
            address: formData.address,
            planCode: selectedPlan.code,
            washesPerMonth: selectedPlan.washes,
            priceArs: selectedPlan.price,
          },
        }
      );

      if (error) throw error;

      toast({
        title: "¡Plan activado!",
        description: `Tu plan ${selectedPlan.name} está activo. Te contactamos por WhatsApp.`,
      });

      setIsDialogOpen(false);
      setFormData({ name: "", phone: "", email: "", address: "" });
      setSelectedPlan(null);

      // Redirect to success page
      window.location.href = `/plan-confirmado?plan=${selectedPlan.code}`;
    } catch (err: any) {
      console.error("Subscription error:", err);
      toast({
        title: "Error",
        description: err.message || "No pudimos procesar tu solicitud.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16">
        <div className="container mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-foreground mb-4"
          >
            Planes de Suscripción
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Mantené tu auto siempre impecable. Sin contratos, cancelá cuando
            quieras.
          </motion.p>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PLANS.map((plan, index) => (
              <motion.div
                key={plan.code}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-2xl border-2 p-6 ${
                  plan.popular
                    ? "border-primary bg-primary/5 shadow-xl scale-105"
                    : "border-border bg-card"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Más elegido
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`p-2 rounded-lg ${
                      plan.popular
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {plan.icon}
                  </div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-foreground">
                    {formatPrice(plan.price)}
                  </span>
                  <span className="text-muted-foreground">/mes</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelectPlan(plan)}
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  Elegir {plan.name}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">
            ¿Cómo funciona?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Elegí tu plan",
                desc: "Seleccioná el plan que mejor se adapte a tus necesidades.",
              },
              {
                step: "2",
                title: "Dejá tus datos",
                desc: "Solo necesitamos tu nombre, teléfono y dirección.",
              },
              {
                step: "3",
                title: "Coordinamos por WhatsApp",
                desc: "Te contactamos para agendar tus lavados del mes.",
              },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Checkout Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan
                ? `Activar Plan ${selectedPlan.name}`
                : "Activar Plan"}
            </DialogTitle>
            <DialogDescription>
              {selectedPlan &&
                `${selectedPlan.washes} lavados por mes - ${formatPrice(
                  selectedPlan.price
                )}/mes`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Juan Pérez"
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">WhatsApp *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="11 1234-5678"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="juan@email.com"
              />
            </div>

            <div>
              <Label htmlFor="address">Dirección del vehículo *</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Av. Libertador 1234, CABA"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Activar Plan"
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Te contactamos por WhatsApp para coordinar el pago y tu primer
              lavado.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
