import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Droplets, Leaf, Recycle, Shield, ChevronRight, Check } from "lucide-react";

const features = [
  {
    icon: Recycle,
    title: "Closed-Loop Water Recovery",
    description: "Our proprietary system captures, filters, and recycles wastewater during the wash process, reducing water consumption by up to 80%.",
  },
  {
    icon: Shield,
    title: "Zero Street Contamination",
    description: "Unlike traditional car washes, our system prevents dirty water, soap, and chemicals from entering streets, drains, and waterways.",
  },
  {
    icon: Leaf,
    title: "Biodegradable Products",
    description: "All our cleaning products are 100% biodegradable, non-toxic, and safe for the environment without compromising on cleaning power.",
  },
  {
    icon: Droplets,
    title: "Water-Efficient Technology",
    description: "We use only 5-10 gallons per wash compared to 50+ gallons at traditional car washes – a massive reduction in water waste.",
  },
];

const stats = [
  { value: "80%", label: "Less Water Used" },
  { value: "0", label: "Gallons Wasted to Drains" },
  { value: "100%", label: "Eco-Friendly Products" },
  { value: "5-10", label: "Gallons Per Wash" },
];

const benefits = [
  "Compliant with urban water regulations",
  "Safe for use in any parking location",
  "No negative impact on local ecosystems",
  "Reduces your personal water footprint",
  "Supports sustainable business practices",
  "Future-proof for stricter environmental laws",
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

const Sustainability = () => {
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
              <Leaf className="w-4 h-4" /> Eco-Responsible Car Care
            </span>
            <h1 className="font-display text-5xl md:text-6xl font-black text-background mb-6">
              Cleaner Cars, <br />Cleaner Planet
            </h1>
            <p className="text-xl text-background/90">
              Our innovative water recovery system sets a new standard for environmentally responsible car washing.
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
              Our <span className="text-washero-eco">Eco System</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              How we deliver premium results while protecting the environment
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
                The <span className="text-washero-eco">Greywater Recovery</span> System
              </h2>
              <p className="text-lg text-background/70 leading-relaxed mb-8">
                Traditional car washes send thousands of gallons of contaminated water into storm drains every day. Our closed-loop system changes that entirely.
              </p>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-washero-eco">1</span>
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-background mb-2">Capture</h4>
                    <p className="text-background/70 text-sm">All wastewater is immediately captured at the source</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-washero-eco">2</span>
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-background mb-2">Filter</h4>
                    <p className="text-background/70 text-sm">Multi-stage filtration removes contaminants and particles</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-washero-eco">3</span>
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-background mb-2">Recycle</h4>
                    <p className="text-background/70 text-sm">Clean water is reused, dirty waste is properly disposed</p>
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
                Why It <span className="text-washero-eco">Matters</span>
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
                Traditional vs Washero
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Water per wash</span>
                  <div className="flex gap-4">
                    <span className="text-destructive font-semibold">50+ gal</span>
                    <span className="text-washero-eco font-bold">5-10 gal</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Drain contamination</span>
                  <div className="flex gap-4">
                    <span className="text-destructive font-semibold">Yes</span>
                    <span className="text-washero-eco font-bold">Zero</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Eco products</span>
                  <div className="flex gap-4">
                    <span className="text-destructive font-semibold">Rare</span>
                    <span className="text-washero-eco font-bold">100%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-muted-foreground">Urban compliant</span>
                  <div className="flex gap-4">
                    <span className="text-destructive font-semibold">Often not</span>
                    <span className="text-washero-eco font-bold">Always</span>
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
              Join the <span className="text-washero-eco">Green</span> Revolution
            </h2>
            <p className="text-xl text-background/70 mb-10">
              Choose a car wash that cares about tomorrow. Book your eco-friendly wash today.
            </p>
            <Button variant="hero" size="xl" className="bg-washero-eco hover:bg-washero-eco/90 text-background" asChild>
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

export default Sustainability;
