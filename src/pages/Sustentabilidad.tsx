import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Droplets, Leaf, Recycle, Shield, ChevronRight, Check } from "lucide-react";

const features = [
  {
    icon: Recycle,
    title: "Recuperación de Agua en Circuito Cerrado",
    description: "Nuestro sistema propietario captura, filtra y recicla el agua residual durante el proceso de lavado, reduciendo el consumo hasta un 80%.",
  },
  {
    icon: Shield,
    title: "Cero Contaminación a la Calle",
    description: "A diferencia de los lavaderos tradicionales, nuestro sistema evita que el agua sucia, jabón y químicos lleguen a calles, desagües y cursos de agua.",
  },
  {
    icon: Leaf,
    title: "Productos Biodegradables",
    description: "Todos nuestros productos de limpieza son 100% biodegradables, no tóxicos y seguros para el medio ambiente sin comprometer el poder de limpieza.",
  },
  {
    icon: Droplets,
    title: "Tecnología de Eficiencia Hídrica",
    description: "Usamos solo 20-40 litros por lavado comparado con más de 200 litros en lavaderos tradicionales – una reducción masiva del desperdicio de agua.",
  },
];

const stats = [
  { value: "80%", label: "Menos Agua Usada" },
  { value: "0", label: "Litros a Desagües" },
  { value: "100%", label: "Productos Eco-Friendly" },
  { value: "20-40", label: "Litros Por Lavado" },
];

const benefits = [
  "Cumple con regulaciones urbanas de agua",
  "Seguro para usar en cualquier ubicación",
  "Sin impacto negativo en ecosistemas locales",
  "Reducís tu huella hídrica personal",
  "Apoyás prácticas comerciales sustentables",
  "Preparado para normativas ambientales futuras",
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

const Sustentabilidad = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-24 bg-gradient-to-br from-washero-eco to-washero-eco/80">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-background/20 text-background rounded-full text-sm font-semibold mb-6">
              <Leaf className="w-4 h-4" /> Cuidado Eco-Responsable
            </span>
            <h1 className="font-display text-5xl md:text-6xl font-black text-background mb-6">
              Autos Limpios, <br />Planeta Limpio
            </h1>
            <p className="text-xl text-background/90">
              Nuestro innovador sistema de recuperación de agua establece un nuevo estándar para el lavado de autos ambientalmente responsable.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeInUp}
                className="text-center"
              >
                <p className="font-display text-5xl md:text-6xl font-black text-washero-eco mb-2">
                  {stat.value}
                </p>
                <p className="text-muted-foreground font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl font-black text-foreground mb-4">
              Nuestro <span className="text-washero-eco">Sistema Eco</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Cómo entregamos resultados premium protegiendo el medio ambiente
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className="p-8 rounded-2xl bg-background border border-border hover:border-washero-eco/50 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-2xl bg-washero-eco/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-8 h-8 text-washero-eco" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-display text-4xl md:text-5xl font-black text-background mb-6">
                El Sistema de <span className="text-washero-eco">Recuperación de Agua</span>
              </h2>
              <p className="text-lg text-background/70 leading-relaxed mb-8">
                Los lavaderos tradicionales envían miles de litros de agua contaminada a desagües pluviales cada día. Nuestro sistema de circuito cerrado cambia eso por completo.
              </p>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-washero-eco">1</span>
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-background mb-2">Captura</h4>
                    <p className="text-background/70 text-sm">Toda el agua residual es capturada inmediatamente en origen</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-washero-eco">2</span>
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-background mb-2">Filtrado</h4>
                    <p className="text-background/70 text-sm">Filtración multi-etapa remueve contaminantes y partículas</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-washero-eco">3</span>
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-background mb-2">Reciclado</h4>
                    <p className="text-background/70 text-sm">El agua limpia se reutiliza, los residuos se disponen apropiadamente</p>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-washero-eco/30 to-washero-water/30 flex items-center justify-center">
                <div className="relative">
                  <div className="w-48 h-48 rounded-full bg-washero-eco/20 animate-pulse-soft flex items-center justify-center">
                    <Recycle className="w-24 h-24 text-washero-eco" />
                  </div>
                  <Droplets className="absolute -top-4 -right-4 w-12 h-12 text-washero-water animate-float" />
                  <Leaf className="absolute -bottom-4 -left-4 w-12 h-12 text-washero-eco animate-float" style={{ animationDelay: "1s" }} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-washero-eco-light">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-display text-4xl font-black text-foreground mb-8">
                Por Qué <span className="text-washero-eco">Importa</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-washero-eco/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-washero-eco" />
                    </div>
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-background shadow-card"
            >
              <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                Lavadero Tradicional vs Washero
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Agua por lavado</span>
                  <div className="flex gap-4">
                    <span className="text-destructive font-semibold">200+ L</span>
                    <span className="text-washero-eco font-bold">20-40 L</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Contaminación desagües</span>
                  <div className="flex gap-4">
                    <span className="text-destructive font-semibold">Sí</span>
                    <span className="text-washero-eco font-bold">Cero</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Productos eco</span>
                  <div className="flex gap-4">
                    <span className="text-destructive font-semibold">Raro</span>
                    <span className="text-washero-eco font-bold">100%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-muted-foreground">Cumple normativas</span>
                  <div className="flex gap-4">
                    <span className="text-destructive font-semibold">A veces</span>
                    <span className="text-washero-eco font-bold">Siempre</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
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
              Sumate a la Revolución <span className="text-washero-eco">Verde</span>
            </h2>
            <p className="text-xl text-background/70 mb-10">
              Elegí un lavadero que cuida el mañana. Reservá tu lavado eco-friendly hoy.
            </p>
            <Button variant="hero" size="xl" className="bg-washero-eco hover:bg-washero-eco/90 text-background" asChild>
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

export default Sustentabilidad;
