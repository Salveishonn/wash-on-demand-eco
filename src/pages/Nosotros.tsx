import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Target, Heart, Leaf, ChevronRight, Users, Award, Clock } from "lucide-react";
import heroImage from "@/assets/hero-washero-branded.jpg";

const values = [
  {
    icon: Target,
    title: "Conveniencia Primero",
    description: "Creamos Washero para eliminar las complicaciones de los lavaderos tradicionales. Tu tiempo es valioso – llevamos el lavadero a vos.",
  },
  {
    icon: Heart,
    title: "Obsesionados con la Calidad",
    description: "No tomamos atajos. Cada lavado usa productos premium y técnicas profesionales para entregar resultados de calidad concesionaria.",
  },
  {
    icon: Leaf,
    title: "Conscientes del Planeta",
    description: "La sustentabilidad no es un agregado – está integrada en todo lo que hacemos, desde nuestro sistema de agua hasta nuestros productos.",
  },
];

const stats = [
  { value: "500+", label: "Clientes Felices", icon: Users },
  { value: "2000+", label: "Autos Lavados", icon: Award },
  { value: "24/7", label: "Soporte Disponible", icon: Clock },
];

const Nosotros = () => {
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
              Sobre <span className="text-primary">Washero</span>
            </h1>
            <p className="text-xl text-background/70">
              Nuestra misión es revolucionar el cuidado de autos – haciéndolo conveniente, premium y sustentable.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-6">
                Nuestra Historia
              </span>
              <h2 className="font-display text-4xl font-black text-foreground mb-6">
                Nacimos de la <span className="text-primary">Frustración</span>
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Washero empezó con una pregunta simple: <em>¿Por qué lavar el auto sigue siendo tan complicado en la era moderna?</em>
                </p>
                <p>
                  Estábamos cansados de manejar hasta lavaderos, esperar en filas y lidiar con resultados inconsistentes. Nos preocupaba el impacto ambiental de los lavaderos tradicionales que tiran miles de litros de agua contaminada a los desagües.
                </p>
                <p>
                  Entonces construimos algo mejor – un servicio premium de lavado a domicilio que va hasta vos, usa tecnología de punta para recuperar agua, y entrega resultados de calidad concesionaria en cada lavado.
                </p>
                <p className="font-semibold text-foreground">
                  Washero no es solo un lavadero – es una forma más inteligente, limpia y sustentable de cuidar tu vehículo, diseñada para la vida urbana moderna.
                </p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 to-washero-eco/20 flex items-center justify-center">
                <span className="font-display text-8xl font-black text-primary">W</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl font-black text-foreground mb-4">
              Nuestros <span className="text-primary">Valores</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Lo que nos impulsa cada día
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 rounded-2xl bg-background"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <value.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                  {value.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-8 h-8 text-primary" />
                </div>
                <p className="font-display text-5xl font-black text-primary mb-2">
                  {stat.value}
                </p>
                <p className="text-background/70">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Buenos Aires Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="font-display text-4xl font-black text-foreground mb-6">
              Orgullosamente de <span className="text-primary">Buenos Aires</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Washero nació en Buenos Aires para servir a los porteños. Conocemos las calles, los barrios y las necesidades de quienes viven y trabajan en la ciudad. Actualmente cubrimos las principales zonas de CABA y GBA, y seguimos expandiéndonos.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Palermo", "Belgrano", "Recoleta", "Núñez", "Caballito", "Villa Crespo", "San Isidro", "Vicente López"].map((zona) => (
                <span key={zona} className="px-4 py-2 bg-secondary rounded-full text-sm font-medium text-foreground">
                  {zona}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-6">
              Experimentá la <span className="text-primary">Diferencia</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Sumate a la familia Washero y descubrí una mejor forma de mantener tu auto impecable.
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/reservar">
                Reservá Tu Primer Lavado <ChevronRight className="w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Nosotros;
