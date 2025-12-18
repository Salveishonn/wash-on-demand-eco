import { Link } from "react-router-dom";
import { Instagram, Facebook, MessageCircle, Mail, MapPin } from "lucide-react";
import washeroLogo from "@/assets/washero-logo.jpeg";

const footerLinks = {
  services: [
    { label: "Exterior Wash", href: "/services" },
    { label: "Interior Cleaning", href: "/services" },
    { label: "Full Detail", href: "/services" },
    { label: "Book Now", href: "/booking" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Sustainability", href: "/sustainability" },
    { label: "FAQ", href: "/faq" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact", href: "/contact" },
  ],
};

const socialLinks = [
  { icon: Instagram, href: "https://instagram.com/washero", label: "Instagram" },
  { icon: Facebook, href: "https://facebook.com/washero", label: "Facebook" },
  { icon: MessageCircle, href: "https://wa.me/1234567890", label: "WhatsApp" },
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
              Premium mobile car wash service. Eco-friendly, convenient, and professional results at your doorstep.
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

          {/* Services */}
          <div>
            <h4 className="font-display font-bold text-background mb-6">Services</h4>
            <ul className="space-y-3">
              {footerLinks.services.map((link) => (
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

          {/* Company */}
          <div>
            <h4 className="font-display font-bold text-background mb-6">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
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

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-background mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5" />
                <a href="mailto:hello@washero.com" className="text-sm hover:text-primary transition-colors">
                  hello@washero.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-primary mt-0.5" />
                <a href="https://wa.me/1234567890" className="text-sm hover:text-primary transition-colors">
                  WhatsApp Support
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <span className="text-sm">Service areas available</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-washero-charcoal-light">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm opacity-70">
              © {new Date().getFullYear()} Washero. All rights reserved.
            </p>
            <p className="text-sm opacity-70 flex items-center gap-2">
              🌱 Committed to eco-responsible car care
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
