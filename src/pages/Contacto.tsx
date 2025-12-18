import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, MessageCircle, Instagram, Facebook, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const contactMethods = [
  {
    icon: Mail,
    title: "Email",
    value: "hola@washero.com.ar",
    href: "mailto:hola@washero.com.ar",
    description: "Respondemos en menos de 24 horas",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    value: "+54 11 1234-5678",
    href: "https://wa.me/5491112345678",
    description: "Respuestas rápidas en horario comercial",
  },
  {
    icon: Phone,
    title: "Teléfono",
    value: "+54 11 1234-5678",
    href: "tel:+5491112345678",
    description: "Lun-Sáb 9:00-18:00",
  },
];

const socialLinks = [
  { icon: Instagram, href: "https://instagram.com/washero.ar", label: "Instagram" },
  { icon: Facebook, href: "https://facebook.com/washero.ar", label: "Facebook" },
];

const Contacto = () => {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "¡Mensaje Enviado!",
      description: "Te responderemos lo antes posible.",
    });
    setSubmitted(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
              Ponete en <span className="text-primary">Contacto</span>
            </h1>
            <p className="text-xl text-background/70">
              ¿Tenés preguntas? Estamos para ayudarte. Escribinos cuando quieras.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16 bg-background border-b border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {contactMethods.map((method, index) => (
              <motion.a
                key={method.title}
                href={method.href}
                target={method.title === "WhatsApp" ? "_blank" : undefined}
                rel={method.title === "WhatsApp" ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-8 rounded-2xl bg-secondary hover:bg-primary/10 transition-all duration-300 text-center group"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary transition-all">
                  <method.icon className="w-8 h-8 text-primary group-hover:text-washero-charcoal" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  {method.title}
                </h3>
                <p className="text-primary font-semibold mb-1">{method.value}</p>
                <p className="text-sm text-muted-foreground">{method.description}</p>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-display text-4xl font-black text-foreground mb-6">
                Envianos un <span className="text-primary">Mensaje</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Ya sea que tengas una pregunta sobre nuestros servicios, precios o cualquier otra cosa, nuestro equipo está listo para responder todas tus consultas.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-foreground mb-1">
                      Zona de Cobertura
                    </h4>
                    <p className="text-muted-foreground">
                      Buenos Aires (CABA y GBA). Contactanos para verificar si cubrimos tu zona.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <h4 className="font-display font-bold text-foreground mb-4">
                  Seguinos
                </h4>
                <div className="flex gap-4">
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-washero-charcoal transition-all"
                      aria-label={social.label}
                    >
                      <social.icon className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              {submitted ? (
                <div className="p-12 rounded-2xl bg-secondary text-center">
                  <div className="w-20 h-20 rounded-full bg-washero-eco/20 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-washero-eco" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    ¡Mensaje Enviado!
                  </h3>
                  <p className="text-muted-foreground mb-8">
                    Gracias por contactarnos. Te responderemos en menos de 24 horas.
                  </p>
                  <Button variant="outline" onClick={() => setSubmitted(false)}>
                    Enviar Otro Mensaje
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-secondary space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name">Nombre</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Juan Pérez"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        required
                        className="mt-2 h-12"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="juan@ejemplo.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                        className="mt-2 h-12"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="subject">Asunto</Label>
                    <Input
                      id="subject"
                      type="text"
                      placeholder="¿En qué podemos ayudarte?"
                      value={formData.subject}
                      onChange={(e) => handleInputChange("subject", e.target.value)}
                      required
                      className="mt-2 h-12"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="message">Mensaje</Label>
                    <Textarea
                      id="message"
                      placeholder="Contanos más..."
                      value={formData.message}
                      onChange={(e) => handleInputChange("message", e.target.value)}
                      required
                      rows={5}
                      className="mt-2 resize-none"
                    />
                  </div>
                  
                  <Button type="submit" variant="hero" size="lg" className="w-full">
                    Enviar Mensaje <Send className="w-4 h-4" />
                  </Button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contacto;
