import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { 
  CheckCircle, 
  ChevronRight, 
  Sparkles, 
  Car, 
  Truck, 
  MessageCircle,
  CreditCard,
  Banknote,
  QrCode,
  Home,
  Star,
  Check
} from "lucide-react";
import { getWhatsAppUrl } from "@/config/whatsapp";
import { 
  SERVICES, 
  VEHICLE_SIZES, 
  EXTRAS, 
  SUBSCRIPTION_PLANS, 
  formatPrice 
} from "@/config/services";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Payment methods
const metodosPago = [
  { name: "Efectivo", icon: Banknote },
  { name: "Transferencia", icon: CreditCard },
  { name: "Mercado Pago", icon: QrCode },
  { name: "Débito / Crédito", icon: CreditCard },
];

// Map icons to services
const serviceIcons: Record<string, typeof Car> = {
  basico: Car,
  completo: Sparkles,
};

const Servicios = () => {
  const whatsappUrl = getWhatsAppUrl("Hola! Quiero reservar un lavado con Washero 🚗");

  const scrollToPlanes = () => {
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });
  };
  
  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-washero-charcoal to-washero-charcoal/95">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h1 className="font-display text-4xl md:text-5xl font-black text-background mb-4">
              Servicios & <span className="text-primary">Planes</span>
            </h1>
            <p className="text-lg text-background/80">
              Lavamos tu auto en tu casa, sin que pierdas tiempo.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Individual Services - From Config */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-2xl md:text-3xl font-bold text-foreground mb-8 text-center"
          >
            Servicios Individuales
          </motion.h2>
          
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto"
          >
            {/* Base Services */}
            {SERVICES.map((service) => {
              const Icon = serviceIcons[service.id] || Car;
              return (
                <motion.div
                  key={service.id}
                  variants={fadeInUp}
                  className="p-6 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg font-bold text-foreground">
                        {service.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {service.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {service.durationMinutes} min
                      </p>
                      <p className="font-display text-2xl font-black mt-2 text-primary">
                        {formatPrice(service.priceCents)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Vehicle Size Extra - From Config */}
            {VEHICLE_SIZES.filter(v => v.extraCents > 0).map((size) => (
              <motion.div
                key={size.id}
                variants={fadeInUp}
                className="p-6 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-muted">
                    <Truck className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg font-bold text-foreground">
                      {size.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cargo adicional
                    </p>
                    <p className="font-display text-2xl font-black mt-2 text-muted-foreground">
                      + {formatPrice(size.extraCents)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Extras Section - From Config */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2 text-center"
          >
            Extras
          </motion.h2>
          <p className="text-center text-muted-foreground mb-8">
            Agregá estos servicios adicionales a tu lavado
          </p>
          
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto"
          >
            {EXTRAS.map((extra) => (
              <motion.div 
                key={extra.id} 
                variants={fadeInUp} 
                className="px-4 py-3 rounded-full bg-background border border-border"
              >
                <span className="font-medium text-foreground">{extra.name}</span>
                <span className="ml-2 text-primary font-bold">{formatPrice(extra.priceCents)}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Monthly Plans - From Config */}
      <section id="planes" className="py-16 bg-background scroll-mt-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
              Planes Mensuales
            </h2>
            <p className="text-muted-foreground">
              Mantené tu auto siempre impecable con un plan a tu medida
            </p>
          </motion.div>
          
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          >
            {SUBSCRIPTION_PLANS.map((plan) => (
              <motion.div
                key={plan.id}
                variants={fadeInUp}
                className={`relative p-6 md:p-8 rounded-2xl border-2 transition-all ${
                  plan.popular
                    ? 'border-primary bg-primary/5 shadow-gold md:scale-105 z-10'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-washero-charcoal text-sm font-bold rounded-full whitespace-nowrap flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Más elegido
                  </span>
                )}
                
                <h3 className="font-display text-xl md:text-2xl font-bold text-foreground mb-2 mt-2">
                  {plan.name}
                </h3>
                
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-display text-3xl md:text-4xl font-black text-primary">
                    {formatPrice(plan.priceCents)}
                  </span>
                  <span className="text-muted-foreground text-sm">/ mes</span>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-5 h-5 text-washero-eco shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  variant={plan.popular ? "hero" : "outline"}
                  className="w-full"
                  size="lg"
                  asChild
                >
                  <Link to={`/suscripciones?plan=${plan.id}`}>
                    Suscribirme <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </motion.div>
            ))}
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-muted-foreground mt-8 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 text-washero-eco" />
            Los planes se abonan por adelantado
          </motion.p>
        </div>
      </section>

      {/* Barrios Cerrados */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Home className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg md:text-xl font-bold text-foreground mb-2">
                  🏘️ Barrios Cerrados
                </h3>
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">5 o más autos del mismo barrio →</span>{" "}
                  <span className="text-primary font-bold">10–15% OFF</span>
                  <br />
                  <span className="text-sm">Mismo día y horario</span>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-xl font-bold text-foreground mb-6 text-center"
          >
            Medios de Pago
          </motion.h3>
          
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="flex flex-wrap justify-center gap-4 max-w-2xl mx-auto"
          >
            {metodosPago.map((metodo) => (
              <motion.div
                key={metodo.name}
                variants={fadeInUp}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border"
              >
                <metodo.icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{metodo.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Sticky CTA for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border md:hidden z-50">
        <div className="flex gap-3">
          <Button 
            variant="hero" 
            size="lg" 
            className="flex-1"
            asChild
          >
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-5 h-5 mr-2" />
              Reservar por WhatsApp
            </a>
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            onClick={scrollToPlanes}
          >
            Planes
          </Button>
        </div>
      </div>

      {/* Desktop CTA Section */}
      <section className="py-16 bg-washero-charcoal hidden md:block">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="font-display text-3xl md:text-4xl font-black text-background mb-4">
              ¿Listo para <span className="text-primary">empezar?</span>
            </h2>
            <p className="text-lg text-background/70 mb-8">
              Reservá tu lavado ahora o consultanos sobre los planes mensuales.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Reservar por WhatsApp
                </a>
              </Button>
              <Button variant="heroDark" size="lg" onClick={scrollToPlanes}>
                Consultar planes mensuales
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom padding for mobile sticky CTA */}
      <div className="h-24 md:hidden" />
    </Layout>
  );
};

export default Servicios;
