import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Calendar, Truck, Sparkles, ChevronRight, Check, MapPin, Droplet, Plug } from "lucide-react";
import heroImage from "@/assets/hero-washero-branded.jpg";

const steps = [
  {
    number: "01",
    title: "Reservá Online",
    description: "Elegí tu servicio, seleccioná fecha y hora que te convengan, e ingresá tu ubicación. La reserva toma menos de 2 minutos.",
    icon: Calendar,
    details: [
      "Seleccioná de nuestros paquetes de servicio",
      "Elegí tu fecha y hora preferida",
      "Ingresá tu dirección (casa, oficina o cochera)",
      "Agregá pedidos especiales",
    ],
  },
  {
    number: "02",
    title: "Llegamos Equipados",
    description: "Nuestro equipo profesional llega a tu ubicación con todo lo necesario. No necesitás agua, electricidad ni preparación de tu parte.",
    icon: Truck,
    details: [
      "Unidad móvil autónoma",
      "Sistema de recuperación de agua a bordo",
      "Equipamiento de grado profesional",
      "Productos de limpieza eco-friendly",
    ],
  },
  {
    number: "03",
    title: "Disfrutá tu Auto Impecable",
    description: "Relajate mientras trabajamos. En solo 45 minutos a unas horas (según el servicio), tu auto quedará impecable.",
    icon: Sparkles,
    details: [
      "Resultados de calidad concesionaria",
      "Cero impacto ambiental",
      "Opciones de pago convenientes",
      "Satisfacción garantizada",
    ],
  },
];

const requirements = [
  {
    icon: MapPin,
    title: "Espacio de Estacionamiento",
    description: "Un espacio donde podamos acceder a tu vehículo (entrada, cochera, estacionamiento)",
    required: true,
  },
  {
    icon: Droplet,
    title: "Conexión de Agua",
    description: "Traemos nuestro propio suministro de agua – no necesitás proveer nada",
    required: false,
  },
  {
    icon: Plug,
    title: "Electricidad",
    description: "Nuestro equipo funciona a batería – no necesitamos enchufe",
    required: false,
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const ComoFunciona = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-24 bg-washero-charcoal relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display text-5xl md:text-6xl font-black text-background mb-6">
              Cómo <span className="text-primary">Funciona</span>
            </h1>
            <p className="text-xl text-background/70">
              Tener tu auto profesionalmente limpio nunca fue tan fácil. Así es como funciona.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="space-y-24">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <span className="font-display text-8xl font-black text-primary/20">
                    {step.number}
                  </span>
                  <h2 className="font-display text-4xl font-black text-foreground -mt-8 mb-6">
                    {step.title}
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    {step.description}
                  </p>
                  <ul className="space-y-4">
                    {step.details.map((detail) => (
                      <li key={detail} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-washero-eco/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-washero-eco" />
                        </div>
                        <span className="text-foreground">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className={`${index % 2 === 1 ? "lg:order-1" : ""}`}>
                  <div className="aspect-square rounded-3xl bg-secondary flex items-center justify-center">
                    <div className="w-32 h-32 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <step.icon className="w-16 h-16 text-primary" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements Section */}
      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl font-black text-foreground mb-4">
              Qué <span className="text-primary">Necesitás</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Spoiler: ¡casi nada! Nosotros llevamos todo.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {requirements.map((req) => (
              <motion.div
                key={req.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-8 rounded-2xl bg-background text-center"
              >
                <div className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center ${
                  req.required ? "bg-primary/10" : "bg-muted"
                }`}>
                  <req.icon className={`w-8 h-8 ${req.required ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {req.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {req.description}
                </p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  req.required
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {req.required ? "Necesario" : "No Necesario"}
                </span>
              </motion.div>
            ))}
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
              ¿Listo para <span className="text-primary">Empezar?</span>
            </h2>
            <p className="text-xl text-background/70 mb-10">
              Reservá tu primer lavado en menos de 2 minutos. Así de fácil.
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

export default ComoFunciona;
