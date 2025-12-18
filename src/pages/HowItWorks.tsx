import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Calendar, Truck, Sparkles, ChevronRight, Check, MapPin, Droplet, Plug } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Book Online",
    description: "Choose your service, select a date and time that works for you, and enter your location. Booking takes less than 2 minutes.",
    icon: Calendar,
    details: [
      "Select from our service packages",
      "Pick your preferred date and time",
      "Enter your address (home, office, or parking)",
      "Add any special requests",
    ],
  },
  {
    number: "02",
    title: "We Arrive Fully Equipped",
    description: "Our professional team comes to your location with everything needed. No water, electricity, or preparation required from you.",
    icon: Truck,
    details: [
      "Self-contained mobile unit",
      "Water-recovery system onboard",
      "Professional-grade equipment",
      "Eco-friendly cleaning products",
    ],
  },
  {
    number: "03",
    title: "Drive Away Clean",
    description: "Relax while we work. In just 45 minutes to a few hours (depending on service), your car will be spotless.",
    icon: Sparkles,
    details: [
      "Dealership-quality results",
      "Zero environmental impact",
      "Convenient payment options",
      "Satisfaction guaranteed",
    ],
  },
];

const requirements = [
  {
    icon: MapPin,
    title: "Parking Space",
    description: "A space where we can access your vehicle (driveway, parking lot, street parking)",
    required: true,
  },
  {
    icon: Droplet,
    title: "Water Connection",
    description: "We bring our own water supply – you don't need to provide anything",
    required: false,
  },
  {
    icon: Plug,
    title: "Electricity",
    description: "Our equipment is battery-powered – no outlet needed",
    required: false,
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const HowItWorks = () => {
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
              How It <span className="text-primary">Works</span>
            </h1>
            <p className="text-xl text-background/70">
              Getting your car professionally cleaned has never been this easy. Here's what to expect.
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
              What You <span className="text-primary">Need</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Spoiler: not much! We bring everything with us.
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
                  {req.required ? "Required" : "Not Required"}
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
              Ready to <span className="text-primary">Get Started?</span>
            </h2>
            <p className="text-xl text-background/70 mb-10">
              Book your first wash in under 2 minutes. It's that easy.
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/booking">
                Book Now <ChevronRight className="w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default HowItWorks;
