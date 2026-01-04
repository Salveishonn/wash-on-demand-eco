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
  Check,
  Loader2,
  Clock,
  Droplets,
  Armchair,
  Wind,
  Waves
} from "lucide-react";
import { getWhatsAppUrl } from "@/config/whatsapp";
import { usePricing, formatPrice } from "@/hooks/usePricing";

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

const iconMap: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-5 h-5" />,
  Armchair: <Armchair className="w-5 h-5" />,
  Wind: <Wind className="w-5 h-5" />,
  Waves: <Waves className="w-5 h-5" />,
};

const Servicios = () => {
  const { data: pricing, isLoading } = usePricing();
  const whatsappUrl = getWhatsAppUrl("Hola! Quiero reservar un lavado con Washero 🚗");

  const scrollToPlanes = () => {
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
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

      {/* Individual Services */}
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
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto"
          >
            {pricing?.services.map((service) => (
              <motion.div
                key={service.item_code}
                variants={fadeInUp}
                className="p-6 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                    <Droplets className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl font-bold text-foreground">
                      {service.display_name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {service.metadata.description}
                    </p>
                    {service.metadata.duration_min && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                        <Clock className="w-4 h-4" />
                        <span>{service.metadata.duration_min} min</span>
                      </div>
                    )}
                    <p className="font-display text-2xl font-black mt-3 text-primary">
                      {formatPrice(service.price_ars)}
                    </p>
                  </div>
                </div>
                <Button variant="hero" className="w-full mt-4" asChild>
                  <Link to="/reservar">Reservar</Link>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Vehicle Size Section */}
      <section className="py-10 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-xl md:text-2xl font-bold text-foreground mb-6 text-center"
          >
            Precio según tipo de vehículo
          </motion.h2>
          
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-3 gap-4 max-w-2xl mx-auto"
          >
            {pricing?.vehicleExtras.map((vehicle) => (
              <motion.div
                key={vehicle.item_code}
                variants={fadeInUp}
                className="p-4 rounded-xl border border-border bg-card text-center"
              >
                <Car className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium text-foreground text-sm">{vehicle.display_name}</p>
                <p className="text-primary font-bold mt-1">
                  {vehicle.price_ars === 0 ? "Sin cargo" : `+${formatPrice(vehicle.price_ars)}`}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Extras Section */}
      <section className="py-12 bg-background">
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
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {pricing?.extras.map((extra) => (
              <motion.div
                key={extra.item_code}
                variants={fadeInUp}
                className="p-4 rounded-xl border border-border bg-card text-center hover:border-primary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
                  {iconMap[extra.metadata.icon || 'Sparkles'] || <Sparkles className="w-5 h-5" />}
                </div>
                <h4 className="font-medium text-foreground text-sm mb-1">{extra.display_name}</h4>
                <p className="text-primary font-bold">{formatPrice(extra.price_ars)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Monthly Plans */}
      <section id="planes" className="py-16 bg-muted/30 scroll-mt-16">
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
            {pricing?.plans.map((plan) => {
              const isPopular = plan.item_code === "confort";
              const washesPerMonth = plan.metadata.washes_per_month || 0;
              const includedService = plan.metadata.included_service;
              const includedVehicle = plan.metadata.included_vehicle_size;

              return (
                <motion.div
                  key={plan.item_code}
                  variants={fadeInUp}
                  className={`relative p-6 md:p-8 rounded-2xl border-2 transition-all ${
                    isPopular
                      ? 'border-primary bg-primary/5 shadow-gold md:scale-105 z-10'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-washero-charcoal text-sm font-bold rounded-full whitespace-nowrap flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Más elegido
                    </span>
                  )}
                  
                  <h3 className="font-display text-xl md:text-2xl font-bold text-foreground mb-2 mt-2">
                    {plan.display_name}
                  </h3>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="font-display text-3xl md:text-4xl font-black text-primary">
                      {formatPrice(plan.price_ars)}
                    </span>
                    <span className="text-muted-foreground text-sm">/ mes</span>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-5 h-5 text-washero-eco shrink-0 mt-0.5" />
                      <span className="text-foreground">
                        {washesPerMonth} lavado{washesPerMonth !== 1 ? 's' : ''} por mes
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-5 h-5 text-washero-eco shrink-0 mt-0.5" />
                      <span className="text-foreground">
                        Servicio: {includedService === 'basic' ? 'Lavado Básico' : 'Lavado Completo'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-5 h-5 text-washero-eco shrink-0 mt-0.5" />
                      <span className="text-foreground">
                        Vehículo: {includedVehicle === 'small' ? 'Auto chico' : includedVehicle === 'suv' ? 'SUV' : 'Pick Up'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-5 h-5 text-washero-eco shrink-0 mt-0.5" />
                      <span className="text-foreground">Sin cargos extra</span>
                    </li>
                  </ul>
                  
                  <Button
                    variant={isPopular ? "hero" : "outline"}
                    className="w-full"
                    size="lg"
                    asChild
                  >
                    <Link to={`/suscripciones?plan=${plan.item_code}`}>
                      Suscribirme <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </motion.div>
              );
            })}
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
      <section className="py-8 bg-background">
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
      <section className="py-12 bg-muted/30">
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border"
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
            <Link to="/reservar">
              Reservar ahora
            </Link>
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
                <Link to="/reservar">
                  Reservar ahora
                </Link>
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
