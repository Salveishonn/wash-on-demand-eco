import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import {
  Car,
  Droplets,
  Clock,
  Leaf,
  MapPin,
  Sparkles,
  Shield,
  Star,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import heroImage from "@/assets/hero-washero-branded.jpg";
import detailImage from "@/assets/washero-detail-1.jpg";
import interiorImage from "@/assets/washero-interior.jpg";

const benefits = [
  {
    icon: MapPin,
    title: "Vamos a Vos",
    description: "A tu casa, oficina o cochera – donde esté tu auto.",
  },
  {
    icon: Droplets,
    title: "Sistema Ahorra Agua",
    description: "Tecnología de recuperación de agua cerrada y eco-friendly.",
  },
  {
    icon: Sparkles,
    title: "Equipamiento Profesional",
    description: "Resultados de concesionaria con productos premium.",
  },
  {
    icon: Clock,
    title: "Sin Esperas",
    description: "Ahorrá tiempo – nosotros nos encargamos de todo.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Reservá Online",
    description: "Elegí tu servicio, fecha y ubicación en pocos clicks.",
  },
  {
    step: "02",
    title: "Llegamos Equipados",
    description: "Nuestro equipo llega con todo lo necesario – sin agua ni electricidad de tu parte.",
  },
  {
    step: "03",
    title: "Disfrutá tu Auto Impecable",
    description: "Tu auto queda perfecto sin esfuerzo ni culpa ambiental.",
  },
];

const services = [
  {
    name: "Lavado Exterior",
    description: "Limpieza exterior completa con productos eco-friendly",
    price: "Desde $25.000",
    time: "45 min",
    features: ["Lavado a mano", "Llantas y cubiertas", "Vidrios", "Secado premium"],
  },
  {
    name: "Limpieza Interior",
    description: "Detailing interior profundo para un habitáculo impecable",
    price: "Desde $35.000",
    time: "60 min",
    features: ["Aspirado completo", "Tablero y consola", "Asientos", "Aromatización"],
  },
  {
    name: "Detailing Completo",
    description: "Transformación premium de tu vehículo",
    price: "Desde $75.000",
    time: "2-3 horas",
    features: ["Exterior completo", "Interior completo", "Encerado", "Motor"],
    popular: true,
  },
];

const testimonials = [
  {
    name: "Martín G.",
    role: "Palermo, Buenos Aires",
    content: "Washero me ahorró horas cada mes. Vienen a mi oficina y mi auto queda impecable. ¡Excelente servicio!",
    rating: 5,
  },
  {
    name: "Carolina S.",
    role: "Belgrano, Buenos Aires",
    content: "Por fin un lavadero que cuida el medio ambiente. El sistema de ahorro de agua es brillante y los resultados increíbles.",
    rating: 5,
  },
  {
    name: "Diego M.",
    role: "Recoleta, Buenos Aires",
    content: "Con tres chicos, mi auto siempre está sucio. El detailing interior de Washero es una salvación – se ocupan de todo.",
    rating: 5,
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

const Index = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-washero-charcoal via-washero-charcoal/90 to-transparent" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <span className="inline-block px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-semibold mb-6">
              Lavado Premium a Domicilio en Buenos Aires
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-black text-background leading-tight mb-6">
              Vamos
              <br />
              <span className="text-primary">a Vos.</span>
            </h1>
            <p className="text-xl text-background/80 mb-8 leading-relaxed">
              Eco-friendly • Ahorrá tiempo • Resultados profesionales
              <br />
              Cuidado premium de tu auto en tu puerta.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/reservar">
                  Reservar Ahora <ChevronRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="heroDark" size="xl" asChild>
                <Link to="/servicios">Ver Servicios</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                variants={fadeInUp}
                className="group p-8 rounded-2xl bg-secondary hover:bg-primary/10 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                  <benefit.icon className="w-7 h-7 text-primary group-hover:text-washero-charcoal" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-background mb-4">
              Cómo <span className="text-primary">Funciona</span>
            </h2>
            <p className="text-xl text-background/70 max-w-2xl mx-auto">
              Lavar tu auto nunca fue tan fácil
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {howItWorks.map((item, index) => (
              <motion.div
                key={item.step}
                variants={fadeInUp}
                className="relative text-center p-8"
              >
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 font-display text-8xl font-black text-primary/20">
                  {item.step}
                </span>
                <div className="relative z-10 pt-12">
                  <h3 className="font-display text-2xl font-bold text-background mb-4">
                    {item.title}
                  </h3>
                  <p className="text-background/70 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-primary" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button variant="hero" size="lg" asChild>
              <Link to="/como-funciona">Conocé Más</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Services Preview Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-4">
              Nuestros <span className="text-primary">Servicios</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Elegí el paquete perfecto para tu vehículo
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {services.map((service) => (
              <motion.div
                key={service.name}
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
                <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                  {service.name}
                </h3>
                <p className="text-muted-foreground mb-4">{service.description}</p>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-display text-3xl font-black text-primary">
                    {service.price}
                  </span>
                  <span className="text-muted-foreground">• {service.time}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="w-5 h-5 text-washero-eco" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={service.popular ? "hero" : "outline"}
                  className="w-full"
                  asChild
                >
                  <Link to="/reservar">Reservar</Link>
                </Button>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button variant="outline" size="lg" asChild>
              <Link to="/servicios">Ver Todos los Servicios</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Service Images Section */}
      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-4">
              Calidad <span className="text-primary">Premium</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Cada detalle cuenta para nosotros
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative rounded-2xl overflow-hidden aspect-square"
            >
              <img
                src={detailImage}
                alt="Detailing exterior Washero"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-washero-charcoal/80 to-transparent flex items-end p-8">
                <div>
                  <h3 className="font-display text-2xl font-bold text-background mb-2">
                    Lavado Exterior Premium
                  </h3>
                  <p className="text-background/80">
                    Técnicas profesionales para un brillo impecable
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative rounded-2xl overflow-hidden aspect-square"
            >
              <img
                src={interiorImage}
                alt="Limpieza interior Washero"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-washero-charcoal/80 to-transparent flex items-end p-8">
                <div>
                  <h3 className="font-display text-2xl font-bold text-background mb-2">
                    Limpieza Interior Profunda
                  </h3>
                  <p className="text-background/80">
                    Cada rincón de tu habitáculo, impecable
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Eco Section */}
      <section className="py-24 bg-washero-eco-light">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-washero-eco/20 text-washero-eco rounded-full text-sm font-semibold mb-6">
                <Leaf className="w-4 h-4" /> Eco-Responsable
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-6">
                Autos Limpios,
                <br />
                <span className="text-washero-eco">Planeta Limpio</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Nuestro sistema de recuperación de agua captura, filtra y gestiona las aguas residuales, reduciendo drásticamente el consumo y evitando la contaminación de calles y desagües.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center">
                    <Droplets className="w-5 h-5 text-washero-eco" />
                  </div>
                  <span className="font-medium">Hasta 80% menos agua que lavaderos tradicionales</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-washero-eco" />
                  </div>
                  <span className="font-medium">Cero contaminación a calles y desagües</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-washero-eco" />
                  </div>
                  <span className="font-medium">Productos 100% biodegradables</span>
                </li>
              </ul>
              <Button variant="default" size="lg" asChild className="bg-washero-eco hover:bg-washero-eco/90">
                <Link to="/sustentabilidad">Conocé Nuestro Sistema</Link>
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-washero-eco/30 to-washero-water/30 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full bg-washero-eco/20 animate-pulse-soft flex items-center justify-center">
                  <Droplets className="w-24 h-24 text-washero-eco" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-4">
              Lo que Dicen <span className="text-primary">Nuestros Clientes</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Sumate a cientos de autos impecables en Buenos Aires
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {testimonials.map((testimonial) => (
              <motion.div
                key={testimonial.name}
                variants={fadeInUp}
                className="p-8 rounded-2xl bg-secondary"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-display font-bold text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
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
              ¿Listo para un Auto <span className="text-primary">Impecable</span>?
            </h2>
            <p className="text-xl text-background/70 mb-10">
              Reservá tu primer lavado hoy y descubrí la diferencia Washero.
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/reservar">
                Reservar Ahora <ChevronRight className="w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
