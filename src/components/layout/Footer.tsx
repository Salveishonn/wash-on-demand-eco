import { Link } from "react-router-dom";
import { Instagram, Facebook, MessageCircle, Mail, MapPin } from "lucide-react";
import washeroLogo from "@/assets/washero-logo.jpeg";
import { WHATSAPP_BASE_URL } from "@/config/whatsapp";

const footerLinks = {
  servicios: [
    { label: "Lavado Exterior", href: "/servicios" },
    { label: "Limpieza Interior", href: "/servicios" },
    { label: "Detailing Completo", href: "/servicios" },
    { label: "Reservar", href: "/reservar" },
  ],
  empresa: [
    { label: "Nosotros", href: "/nosotros" },
    { label: "Cómo Funciona", href: "/como-funciona" },
    { label: "Sustentabilidad", href: "/sustentabilidad" },
    { label: "FAQ", href: "/preguntas-frecuentes" },
  ],
  legal: [
    { label: "Política de Privacidad", href: "/privacidad" },
    { label: "Términos y Condiciones", href: "/terminos" },
    { label: "Contacto", href: "/contacto" },
  ],
};

const socialLinks = [
  { icon: Instagram, href: "https://instagram.com/washero.ar", label: "Instagram" },
  { icon: Facebook, href: "https://facebook.com/washero.ar", label: "Facebook" },
  { icon: MessageCircle, href: WHATSAPP_BASE_URL, label: "WhatsApp" },
];

export const Footer = () => {
  return (
    <footer className="bg-washero-charcoal text-muted-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <Link to="/" className="inline-block">
              <img 
                src={washeroLogo} 
                alt="Washero" 
                className="h-12 w-auto"
              />
            </Link>
            <p className="text-sm leading-relaxed opacity-80">
              Servicio premium de lavado a domicilio. Eco-friendly, conveniente y resultados profesionales en tu puerta.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-washero-charcoal-light flex items-center justify-center hover:bg-primary hover:text-washero-charcoal transition-all"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Servicios */}
          <div>
            <h4 className="font-display font-bold text-background mb-6">Servicios</h4>
            <ul className="space-y-3">
              {footerLinks.servicios.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="font-display font-bold text-background mb-6">Empresa</h4>
            <ul className="space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="font-display font-bold text-background mb-6">Contactanos</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5" />
                <a href="mailto:hola@washero.com.ar" className="text-sm hover:text-primary transition-colors">
                  hola@washero.com.ar
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-primary mt-0.5" />
                <a href={WHATSAPP_BASE_URL} className="text-sm hover:text-primary transition-colors">
                  WhatsApp
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <span className="text-sm">Buenos Aires, Argentina</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-washero-charcoal-light">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm opacity-70">
              © {new Date().getFullYear()} Washero. Todos los derechos reservados.
            </p>
            <p className="text-sm opacity-70 flex items-center gap-2">
              🌱 Comprometidos con el cuidado del medio ambiente
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
