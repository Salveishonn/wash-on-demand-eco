import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { CheckCircle, Clock, ChevronRight, Sparkles, Car, Sofa, Droplet, Wind, Cog, Leaf, Check } from "lucide-react";
import detailImage from "@/assets/washero-detail-1.jpg";
import interiorImage from "@/assets/washero-interior.jpg";
import { useServiceAddons, ServiceAddon } from "@/hooks/useServiceAddons";
import { useToast } from "@/hooks/use-toast";

const services = [
  {
    id: "exterior",
    name: "Lavado Exterior",
    description: "Limpieza exterior completa con productos eco-friendly y nuestro sistema de ahorro de agua",
    price: "Desde $25.000",
    time: "45 min",
    icon: Car,
    image: detailImage,
    features: [
      "Pre-lavado y aplicación de espuma",
      "Lavado a mano con guantes de microfibra",
      "Limpieza de llantas y cubiertas",
      "Limpieza de vidrios",
      "Enjuague con agua filtrada",
      "Secado a mano con toallas premium",
    ],
  },
  {
    id: "interior",
    name: "Limpieza Interior",
    description: "Detailing interior profundo para un habitáculo fresco e impecable",
    price: "Desde $35.000",
    time: "60 min",
    icon: Sofa,
    image: interiorImage,
    features: [
      "Aspirado completo (asientos, alfombras, baúl)",
      "Limpieza de tablero y consola",
      "Detailing de paneles de puertas",
      "Limpieza de portavasos y ventilaciones",
      "Limpieza de vidrios (interior)",
      "Aplicación de aromatizante",
    ],
  },
  {
    id: "full-detail",
    name: "Detailing Completo",
    description: "Transformación premium completa de tu vehículo – nuestro paquete más elegido",
    price: "Desde $75.000",
    time: "2-3 horas",
    icon: Sparkles,
    popular: true,
    features: [
      "Lavado exterior completo",
      "Limpieza interior completa",
      "Encerado o sellador",
      "Acondicionamiento de cueros",
      "Limpieza de motor",
      "Tratamiento eliminador de olores",
    ],
  },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Droplet,
  Wind,
  Cog,
  Leaf,
};

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

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

const Servicios = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addons, selectedAddons, toggleAddon, isSelected } = useServiceAddons();
  
  const handleReservarWithExtras = () => {
    // Store selected addons in sessionStorage for the booking page
    if (selectedAddons.length > 0) {
      sessionStorage.setItem('preselected_addons', JSON.stringify(selectedAddons));
      toast({
        title: `${selectedAddons.length} extra(s) seleccionado(s)`,
        description: "Se agregarán a tu reserva",
      });
    }
    navigate('/reservar');
  };
  
  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-24 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display text-5xl md:text-6xl font-black text-background mb-6">
              Nuestros <span className="text-primary">Servicios</span>
            </h1>
            <p className="text-xl text-background/70">
              Elegí el paquete perfecto para tu vehículo. Todos incluyen nuestro sistema eco-friendly de ahorro de agua.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {services.map((service) => (
              <motion.div
                key={service.id}
                variants={fadeInUp}
                className={`relative p-8 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-2 ${
                  service.popular
                    ? "border-primary bg-primary/5 shadow-gold"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {service.popular && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-washero-charcoal text-sm font-bold rounded-full">
                    Más Elegido
                  </span>
                )}
                
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <service.icon className="w-8 h-8 text-primary" />
                </div>
                
                <h2 className="font-display text-2xl font-bold text-foreground mb-3">
                  {service.name}
                </h2>
                <p className="text-muted-foreground mb-6">{service.description}</p>
                
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="font-display text-4xl font-black text-primary">
                    {service.price}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {service.time}
                  </span>
                </div>
                
                <div className="border-t border-border pt-6 mb-8">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
                    Qué Incluye
                  </h4>
                  <ul className="space-y-3">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm">
                        <CheckCircle className="w-5 h-5 text-washero-eco shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Button
                  variant={service.popular ? "hero" : "outline"}
                  className="w-full"
                  size="lg"
                  asChild
                >
                  <Link to={`/reservar?servicio=${service.id}`}>
                    Reservar <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl font-black text-foreground mb-4">
              Servicios <span className="text-primary">Adicionales</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Potenciá tu servicio con estos extras premium
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {addons.map((addon) => {
              const IconComponent = iconMap[addon.icon || 'Sparkles'] || Sparkles;
              const selected = isSelected(addon.id);
              
              return (
                <motion.button
                  key={addon.id}
                  variants={fadeInUp}
                  onClick={() => toggleAddon(addon)}
                  className={`relative p-6 rounded-xl bg-background border-2 transition-all duration-300 text-center cursor-pointer ${
                    selected 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-washero-charcoal" />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    selected ? 'bg-primary/20' : 'bg-primary/10'
                  }`}>
                    <IconComponent className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-foreground mb-2">
                    {addon.name}
                  </h3>
                  <p className={`font-bold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                    +{formatPrice(addon.price_cents)}
                  </p>
                </motion.button>
              );
            })}
          </motion.div>
          
          {selectedAddons.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-center"
            >
              <Button variant="hero" size="lg" onClick={handleReservarWithExtras}>
                Reservar con {selectedAddons.length} extra{selectedAddons.length > 1 ? 's' : ''} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-background mb-6">
              ¿No Sabés Cuál <span className="text-primary">Elegir?</span>
            </h2>
            <p className="text-xl text-background/70 mb-10">
              Contactanos y te ayudamos a encontrar el servicio perfecto para tu vehículo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" asChild>
                <Link to="/reservar">Reservar Ahora</Link>
              </Button>
              <Button variant="heroDark" size="lg" asChild>
                <Link to="/contacto">Contactanos</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Servicios;
