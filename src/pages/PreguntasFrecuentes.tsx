import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { ChevronRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    category: "Servicio",
    questions: [
      {
        question: "¿Tengo que estar en casa durante el lavado?",
        answer: "No, no necesitás estar presente. Solo asegurate de que tengamos acceso a tu vehículo (por ejemplo, dejalo en un lugar accesible) y nosotros nos encargamos del resto. Te avisamos cuando terminamos.",
      },
      {
        question: "¿Qué pasa si llueve el día de mi turno?",
        answer: "Si hay pronóstico de lluvia fuerte, te contactamos para reprogramar sin cargo adicional. La lluvia leve generalmente no afecta nuestro servicio ya que nuestro sistema de recuperación de agua maneja la humedad.",
      },
      {
        question: "¿Cuánto tiempo dura un lavado típico?",
        answer: "El lavado exterior toma unos 45 minutos, la limpieza interior unos 60 minutos, y un detailing completo puede llevar 2-3 horas dependiendo del estado del vehículo.",
      },
      {
        question: "¿Pueden lavar mi auto en la cochera de un edificio?",
        answer: "¡Sí! Nuestro sistema de recuperación de agua significa que no dejamos ningún lío, lo que nos hace perfectos para cocheras de edificios, estacionamientos de oficinas y garajes subterráneos.",
      },
    ],
  },
  {
    category: "Reservas y Pagos",
    questions: [
      {
        question: "¿Cómo reservo un lavado?",
        answer: "Simplemente usá nuestro sistema de reservas online, seleccioná tu servicio, elegí fecha y hora, ingresá tu ubicación y confirmá. ¡Toma menos de 2 minutos!",
      },
      {
        question: "¿Cuándo pago?",
        answer: "El pago se realiza después de que el servicio esté completo. Aceptamos efectivo, transferencia, y todos los medios de pago digitales.",
      },
      {
        question: "¿Puedo reprogramar o cancelar mi reserva?",
        answer: "Sí, podés reprogramar o cancelar hasta 24 horas antes de tu turno sin cargo. Contactanos o usá el link de tu confirmación de reserva.",
      },
      {
        question: "¿Ofrecen planes o suscripciones?",
        answer: "¡Sí! Ofrecemos paquetes mensuales de lavado para clientes regulares con tarifas con descuento. Contactanos para conocer nuestras opciones de membresía.",
      },
    ],
  },
  {
    category: "Equipamiento y Seguridad",
    questions: [
      {
        question: "¿El lavado es seguro para la pintura de mi auto?",
        answer: "Absolutamente. Usamos guantes de microfibra premium, jabones de pH balanceado y un sistema de enjuague sin contacto. Nuestras técnicas son seguras para todos los acabados, incluyendo recubrimientos cerámicos y wraps.",
      },
      {
        question: "¿Necesitan agua o electricidad de mi parte?",
        answer: "No. Nuestra unidad móvil es completamente autónoma con su propio suministro de agua y equipo a batería. No necesitás proveer nada.",
      },
      {
        question: "¿Qué productos usan?",
        answer: "Usamos exclusivamente productos de limpieza eco-friendly y biodegradables que son fuertes contra la suciedad pero suaves con tu auto y el medio ambiente.",
      },
    ],
  },
  {
    category: "Sustentabilidad",
    questions: [
      {
        question: "¿Cuánta agua usan comparado con un lavadero normal?",
        answer: "Usamos solo 20-40 litros por lavado comparado con más de 200 litros en lavaderos tradicionales – eso es hasta un 80% menos de agua.",
      },
      {
        question: "¿Qué pasa con el agua residual?",
        answer: "Nuestro sistema de recuperación de agua en circuito cerrado captura toda el agua residual, la filtra y la almacena para su disposición apropiada. Nada llega a calles ni desagües pluviales.",
      },
      {
        question: "¿Sus productos son realmente eco-friendly?",
        answer: "Sí. Todos nuestros productos de limpieza son 100% biodegradables, libres de fosfatos y certificados como ambientalmente seguros. Ningún químico dañino llega al medio ambiente.",
      },
    ],
  },
];

const PreguntasFrecuentes = () => {
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
              Preguntas <span className="text-primary">Frecuentes</span>
            </h1>
            <p className="text-xl text-background/70">
              Todo lo que necesitás saber sobre Washero
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-12">
            {faqs.map((category, categoryIndex) => (
              <motion.div
                key={category.category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: categoryIndex * 0.1 }}
              >
                <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                  {category.category}
                </h2>
                <Accordion type="single" collapsible className="space-y-4">
                  {category.questions.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`${category.category}-${index}`}
                      className="border border-border rounded-xl px-6 data-[state=open]:border-primary/50 data-[state=open]:bg-primary/5"
                    >
                      <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-6">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </motion.div>
            ))}
          </div>
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
            <h2 className="font-display text-4xl font-black text-foreground mb-6">
              ¿Todavía Tenés <span className="text-primary">Dudas?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Nuestro equipo está listo para ayudarte. ¡Contactanos cuando quieras!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" asChild>
                <Link to="/contacto">Contactanos</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/reservar">
                  Reservar Ahora <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default PreguntasFrecuentes;
