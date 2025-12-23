import { useState } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  Car,
  Percent,
  CheckCircle,
  Phone,
  Loader2,
  Star,
  Gift,
} from "lucide-react";
import kipperLogo from "@/assets/kipper-logo.png";

const benefits = [
  {
    icon: Percent,
    title: "Descuentos Exclusivos",
    description: "Accedé a precios especiales en todos nuestros servicios de lavado.",
  },
  {
    icon: Gift,
    title: "Beneficios Adicionales",
    description: "Promociones y ofertas exclusivas para clientes de Kipper Seguros.",
  },
  {
    icon: Star,
    title: "Prioridad de Agenda",
    description: "Reservá en los mejores horarios con prioridad garantizada.",
  },
  {
    icon: Shield,
    title: "Servicio Premium",
    description: "Atención personalizada y servicio de calidad superior.",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function KipperSeguros() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        variant: "destructive",
        title: "Datos incompletos",
        description: "Por favor completá todos los campos obligatorios.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke("create-kipper-lead", {
        body: {
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          notes: formData.notes || "Consulta desde página Kipper Seguros",
          source: "kipper_page",
        },
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "¡Solicitud enviada!",
        description: "Te contactaremos pronto para contarte sobre los beneficios.",
      });
    } catch (error: any) {
      console.error("Error creating lead:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar tu solicitud. Intentá de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-br from-[#8B1E2F] to-[#5a1420]">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <img
                  src={kipperLogo}
                  alt="Kipper Seguros"
                  className="w-14 h-14 object-contain"
                />
              </div>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-black text-white mb-4">
              Washero + <span className="text-primary">Kipper Seguros</span>
            </h1>
            <p className="text-lg text-white/80">
              Una alianza que cuida tu auto por dentro y por fuera
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-4">
              Beneficios <span className="text-[#8B1E2F]">Exclusivos</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Si contratás tu seguro con Kipper Seguros, accedés a beneficios
              especiales en Washero.
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {benefits.map((benefit) => (
              <motion.div
                key={benefit.title}
                variants={fadeInUp}
                className="p-6 rounded-2xl bg-secondary hover:bg-[#8B1E2F]/5 transition-all duration-300 border border-transparent hover:border-[#8B1E2F]/20"
              >
                <div className="w-12 h-12 rounded-xl bg-[#8B1E2F]/10 flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-[#8B1E2F]" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl font-black text-foreground mb-8">
              ¿Cómo <span className="text-[#8B1E2F]">funciona</span>?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#8B1E2F] text-white flex items-center justify-center font-display text-xl font-bold mb-4">
                  1
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  Contratá tu seguro
                </h3>
                <p className="text-sm text-muted-foreground">
                  Elegí el plan que mejor se adapte a tus necesidades con Kipper
                  Seguros.
                </p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#8B1E2F] text-white flex items-center justify-center font-display text-xl font-bold mb-4">
                  2
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  Activá tus beneficios
                </h3>
                <p className="text-sm text-muted-foreground">
                  Completá el formulario y te contactamos para activar tus
                  descuentos.
                </p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#8B1E2F] text-white flex items-center justify-center font-display text-xl font-bold mb-4">
                  3
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  Disfrutá Washero
                </h3>
                <p className="text-sm text-muted-foreground">
                  Reservá tus lavados con precios exclusivos y beneficios
                  adicionales.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-8"
            >
              <h2 className="font-display text-3xl font-black text-foreground mb-4">
                Quiero que me <span className="text-[#8B1E2F]">contacten</span>
              </h2>
              <p className="text-muted-foreground">
                Dejanos tus datos y te contactamos para contarte más sobre los
                beneficios disponibles.
              </p>
            </motion.div>

            {isSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center"
              >
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  ¡Solicitud recibida!
                </h3>
                <p className="text-muted-foreground">
                  Nos comunicaremos con vos pronto para contarte todos los
                  beneficios disponibles.
                </p>
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onSubmit={handleSubmit}
                className="bg-secondary rounded-2xl p-8 space-y-6"
              >
                <div>
                  <Label htmlFor="name">Nombre completo *</Label>
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono / WhatsApp *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+54 11 1234-5678"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Mensaje (opcional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Contanos si ya tenés seguro con Kipper o si querés más información..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#8B1E2F] hover:bg-[#6d1725]"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4 mr-2" />
                      Quiero que me contacten
                    </>
                  )}
                </Button>
              </motion.form>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
