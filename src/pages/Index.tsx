import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import {
  Car,
  Droplets,
  Clock,
  Leaf,
  MapPin,
  Sparkles,
  Shield,
  Star,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import heroImage from "@/assets/hero-car-wash.jpg";

const benefits = [
  {
    icon: MapPin,
    title: "We Come to You",
    description: "Home, office, or parking spot – wherever your car is.",
  },
  {
    icon: Droplets,
    title: "Water-Saving System",
    description: "Eco-friendly closed-loop greywater recovery technology.",
  },
  {
    icon: Sparkles,
    title: "Professional Equipment",
    description: "Dealership-level results with premium products.",
  },
  {
    icon: Clock,
    title: "No Waiting",
    description: "Save time – we handle everything while you relax.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Book Online",
    description: "Choose your service, date, and location in just a few clicks.",
  },
  {
    step: "02",
    title: "We Arrive Fully Equipped",
    description: "Our professional team comes with everything needed – no water or electricity required.",
  },
  {
    step: "03",
    title: "Drive Away Clean",
    description: "Enjoy your spotless car with zero hassle or environmental guilt.",
  },
];

const services = [
  {
    name: "Exterior Wash",
    description: "Complete exterior cleaning with eco-friendly products",
    price: "From $49",
    time: "45 min",
    features: ["Hand wash", "Tire cleaning", "Window cleaning", "Rinse & dry"],
  },
  {
    name: "Interior Cleaning",
    description: "Deep interior detailing for a fresh cabin",
    price: "From $69",
    time: "60 min",
    features: ["Vacuum", "Dashboard clean", "Seat cleaning", "Air freshener"],
  },
  {
    name: "Full Detail",
    description: "Premium complete car transformation",
    price: "From $149",
    time: "2-3 hours",
    features: ["Full exterior", "Full interior", "Wax coating", "Engine bay"],
    popular: true,
  },
];

const testimonials = [
  {
    name: "Sarah M.",
    role: "Busy Professional",
    content: "Washero saved me hours every month. They come to my office parking and my car looks brand new every time!",
    rating: 5,
  },
  {
    name: "David R.",
    role: "Eco-Conscious Driver",
    content: "Finally a car wash that cares about the environment. The water-saving system is brilliant and the results are incredible.",
    rating: 5,
  },
  {
    name: "Maria L.",
    role: "Mom of Three",
    content: "With three kids, my car is always a mess. Washero's interior detailing is a lifesaver – they handle everything!",
    rating: 5,
  },
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

const Index = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-washero-charcoal via-washero-charcoal/90 to-transparent" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <span className="inline-block px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-semibold mb-6">
              Premium Mobile Car Wash
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-black text-background leading-tight mb-6">
              We Come
              <br />
              <span className="text-primary">to You.</span>
            </h1>
            <p className="text-xl text-background/80 mb-8 leading-relaxed">
              Eco-friendly • Time-saving • Professional results
              <br />
              Premium car care at your doorstep.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/booking">
                  Book Now <ChevronRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="heroDark" size="xl" asChild>
                <Link to="/services">View Services</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                variants={fadeInUp}
                className="group p-8 rounded-2xl bg-secondary hover:bg-primary/10 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                  <benefit.icon className="w-7 h-7 text-primary group-hover:text-washero-charcoal" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-background mb-4">
              How It <span className="text-primary">Works</span>
            </h2>
            <p className="text-xl text-background/70 max-w-2xl mx-auto">
              Getting your car cleaned has never been easier
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {howItWorks.map((item, index) => (
              <motion.div
                key={item.step}
                variants={fadeInUp}
                className="relative text-center p-8"
              >
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 font-display text-8xl font-black text-primary/20">
                  {item.step}
                </span>
                <div className="relative z-10 pt-12">
                  <h3 className="font-display text-2xl font-bold text-background mb-4">
                    {item.title}
                  </h3>
                  <p className="text-background/70 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-primary" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button variant="hero" size="lg" asChild>
              <Link to="/how-it-works">Learn More</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Services Preview Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-4">
              Our <span className="text-primary">Services</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the perfect package for your vehicle
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {services.map((service) => (
              <motion.div
                key={service.name}
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
                <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                  {service.name}
                </h3>
                <p className="text-muted-foreground mb-4">{service.description}</p>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-display text-3xl font-black text-primary">
                    {service.price}
                  </span>
                  <span className="text-muted-foreground">• {service.time}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="w-5 h-5 text-washero-eco" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={service.popular ? "hero" : "outline"}
                  className="w-full"
                  asChild
                >
                  <Link to="/booking">Book This Service</Link>
                </Button>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button variant="outline" size="lg" asChild>
              <Link to="/services">View All Services</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Eco Section */}
      <section className="py-24 bg-washero-eco-light">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-washero-eco/20 text-washero-eco rounded-full text-sm font-semibold mb-6">
                <Leaf className="w-4 h-4" /> Eco-Responsible
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-6">
                Cleaner Cars,
                <br />
                <span className="text-washero-eco">Cleaner Planet</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Our closed-loop greywater recovery system captures, filters, and manages wastewater, drastically reducing water consumption and preventing contamination of streets and drains.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center">
                    <Droplets className="w-5 h-5 text-washero-eco" />
                  </div>
                  <span className="font-medium">Up to 80% less water than traditional car washes</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-washero-eco" />
                  </div>
                  <span className="font-medium">No street or drain contamination</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-washero-eco/20 flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-washero-eco" />
                  </div>
                  <span className="font-medium">100% biodegradable cleaning products</span>
                </li>
              </ul>
              <Button variant="default" size="lg" asChild className="bg-washero-eco hover:bg-washero-eco/90">
                <Link to="/sustainability">Learn About Our System</Link>
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-washero-eco/30 to-washero-water/30 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full bg-washero-eco/20 animate-pulse-soft flex items-center justify-center">
                  <Droplets className="w-24 h-24 text-washero-eco" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-4">
              What Our <span className="text-primary">Customers</span> Say
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join hundreds of happy car owners
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {testimonials.map((testimonial) => (
              <motion.div
                key={testimonial.name}
                variants={fadeInUp}
                className="p-8 rounded-2xl bg-secondary"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-display font-bold text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
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
              Ready for a <span className="text-primary">Spotless</span> Car?
            </h2>
            <p className="text-xl text-background/70 mb-10">
              Book your first wash today and experience the Washero difference.
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/booking">
                Book Your Wash <ChevronRight className="w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
