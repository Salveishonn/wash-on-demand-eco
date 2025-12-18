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
    category: "Service",
    questions: [
      {
        question: "Do I need to be home during the wash?",
        answer: "No, you don't need to be present. Just make sure we have access to your vehicle (e.g., leave it in an accessible parking spot) and we'll take care of the rest. We'll notify you when we're done.",
      },
      {
        question: "What if it rains on my scheduled day?",
        answer: "If there's heavy rain forecast, we'll contact you to reschedule at no extra charge. Light rain typically doesn't affect our service as our water-recovery system handles the moisture.",
      },
      {
        question: "How long does a typical wash take?",
        answer: "Exterior wash takes about 45 minutes, interior cleaning about 60 minutes, and a full detail can take 2-3 hours depending on the vehicle's condition.",
      },
      {
        question: "Can you wash my car in an apartment parking lot?",
        answer: "Yes! Our water-recovery system means we don't leave any mess behind, making us perfect for apartment complexes, office parking, and underground garages.",
      },
    ],
  },
  {
    category: "Booking & Payment",
    questions: [
      {
        question: "How do I book a wash?",
        answer: "Simply use our online booking system, select your service, choose a date and time, enter your location, and confirm. It takes less than 2 minutes!",
      },
      {
        question: "When do I pay?",
        answer: "Payment is collected after the service is complete. We accept all major credit cards and digital payment methods.",
      },
      {
        question: "Can I reschedule or cancel my booking?",
        answer: "Yes, you can reschedule or cancel up to 24 hours before your appointment at no charge. Contact us or use your booking confirmation link.",
      },
      {
        question: "Do you offer memberships or subscriptions?",
        answer: "Yes! We offer monthly wash packages for regular customers at discounted rates. Contact us to learn about our membership options.",
      },
    ],
  },
  {
    category: "Equipment & Safety",
    questions: [
      {
        question: "Is your wash safe for my car's paint?",
        answer: "Absolutely. We use premium microfiber mitts, pH-balanced soaps, and a touchless rinse system. Our techniques are safe for all finishes, including ceramic coatings and wraps.",
      },
      {
        question: "Do you need water or electricity from me?",
        answer: "No. Our mobile unit is completely self-contained with its own water supply and battery-powered equipment. You don't need to provide anything.",
      },
      {
        question: "What products do you use?",
        answer: "We exclusively use eco-friendly, biodegradable cleaning products that are tough on dirt but gentle on your car and the environment.",
      },
    ],
  },
  {
    category: "Sustainability",
    questions: [
      {
        question: "How much water do you use compared to a regular car wash?",
        answer: "We use only 5-10 gallons per wash compared to 50+ gallons at traditional car washes – that's up to 80% less water.",
      },
      {
        question: "What happens to the wastewater?",
        answer: "Our closed-loop greywater recovery system captures all wastewater, filters it, and stores it for proper disposal. None of it enters streets or storm drains.",
      },
      {
        question: "Are your products really eco-friendly?",
        answer: "Yes. All our cleaning products are 100% biodegradable, phosphate-free, and certified environmentally safe. No harmful chemicals reach the environment.",
      },
    ],
  },
];

const FAQ = () => {
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
              Frequently Asked <span className="text-primary">Questions</span>
            </h1>
            <p className="text-xl text-background/70">
              Everything you need to know about Washero
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
              Still Have <span className="text-primary">Questions?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Our team is here to help. Reach out anytime!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" asChild>
                <Link to="/contact">Contact Us</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/booking">
                  Book Now <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default FAQ;
