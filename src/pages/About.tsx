import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Target, Heart, Leaf, ChevronRight, Users, Award, Clock } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Convenience First",
    description: "We built Washero to eliminate the hassle of traditional car washes. Your time is valuable – we bring the car wash to you.",
  },
  {
    icon: Heart,
    title: "Quality Obsessed",
    description: "We don't cut corners. Every wash uses premium products and techniques to deliver dealership-quality results.",
  },
  {
    icon: Leaf,
    title: "Planet Conscious",
    description: "Sustainability isn't an afterthought – it's built into everything we do, from our water system to our products.",
  },
];

const stats = [
  { value: "500+", label: "Happy Customers", icon: Users },
  { value: "2000+", label: "Cars Cleaned", icon: Award },
  { value: "24/7", label: "Support Available", icon: Clock },
];

const About = () => {
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
              About <span className="text-primary">Washero</span>
            </h1>
            <p className="text-xl text-background/70">
              We're on a mission to revolutionize car care – making it convenient, premium, and sustainable.
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
                Our Story
              </span>
              <h2 className="font-display text-4xl font-black text-foreground mb-6">
                Born from <span className="text-primary">Frustration</span>
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Washero started with a simple question: <em>Why is getting a car wash still such a hassle in the modern age?</em>
                </p>
                <p>
                  We were tired of driving to car washes, waiting in lines, and dealing with inconsistent results. We were concerned about the environmental impact of traditional washes that dump thousands of gallons of contaminated water into drains.
                </p>
                <p>
                  So we built something better – a premium mobile car wash service that comes to you, uses cutting-edge water-recovery technology, and delivers dealership-quality results every single time.
                </p>
                <p className="font-semibold text-foreground">
                  Washero isn't just a car wash – it's a smarter, cleaner, and more sustainable way to care for your vehicle.
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
              Our <span className="text-primary">Values</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              What drives us every day
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

      {/* CTA Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-6">
              Experience the <span className="text-primary">Difference</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Join the Washero family and discover a better way to keep your car clean.
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/booking">
                Book Your First Wash <ChevronRight className="w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
