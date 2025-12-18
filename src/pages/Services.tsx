import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { CheckCircle, Clock, ChevronRight, Sparkles, Car, Sofa, Droplet, Wind, Cog, Leaf } from "lucide-react";

const services = [
  {
    id: "exterior",
    name: "Exterior Wash",
    description: "Complete exterior cleaning with eco-friendly products and our water-saving system",
    price: "From $49",
    time: "45 min",
    icon: Car,
    features: [
      "Pre-rinse and foam application",
      "Hand wash with microfiber mitts",
      "Wheel and tire cleaning",
      "Window cleaning",
      "Rinse with filtered water",
      "Hand dry with premium towels",
    ],
  },
  {
    id: "interior",
    name: "Interior Cleaning",
    description: "Deep interior detailing for a fresh and spotless cabin",
    price: "From $69",
    time: "60 min",
    icon: Sofa,
    features: [
      "Complete vacuum (seats, carpets, trunk)",
      "Dashboard and console cleaning",
      "Door panel detailing",
      "Cup holder and vent cleaning",
      "Window cleaning (inside)",
      "Air freshener application",
    ],
  },
  {
    id: "full-detail",
    name: "Full Detail",
    description: "Premium complete car transformation – our most popular package",
    price: "From $149",
    time: "2-3 hours",
    icon: Sparkles,
    popular: true,
    features: [
      "Complete exterior wash",
      "Full interior cleaning",
      "Wax or sealant coating",
      "Leather conditioning",
      "Engine bay cleaning",
      "Odor elimination treatment",
    ],
  },
];

const addOns = [
  { name: "Paint Sealant", price: "+$35", icon: Droplet },
  { name: "Pet Hair Removal", price: "+$25", icon: Wind },
  { name: "Engine Bay Clean", price: "+$40", icon: Cog },
  { name: "Odor Elimination", price: "+$30", icon: Leaf },
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

const Services = () => {
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
              Our <span className="text-primary">Services</span>
            </h1>
            <p className="text-xl text-background/70">
              Choose the perfect package for your vehicle. All services include our eco-friendly water-saving system.
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
                    Most Popular
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
                    What's Included
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
                  <Link to={`/booking?service=${service.id}`}>
                    Book Now <ChevronRight className="w-4 h-4" />
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
              Popular <span className="text-primary">Add-ons</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Enhance your service with these premium extras
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {addOns.map((addon) => (
              <motion.div
                key={addon.name}
                variants={fadeInUp}
                className="p-6 rounded-xl bg-background border border-border hover:border-primary/50 transition-all duration-300 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <addon.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-bold text-foreground mb-2">
                  {addon.name}
                </h3>
                <p className="text-primary font-bold">{addon.price}</p>
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
              Not Sure Which to <span className="text-primary">Choose?</span>
            </h2>
            <p className="text-xl text-background/70 mb-10">
              Contact us and we'll help you find the perfect service for your vehicle.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" asChild>
                <Link to="/booking">Book Now</Link>
              </Button>
              <Button variant="heroDark" size="lg" asChild>
                <Link to="/contact">Contact Us</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Services;
