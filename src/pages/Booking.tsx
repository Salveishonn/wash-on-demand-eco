import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Car, CheckCircle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const services = [
  { id: "exterior", name: "Exterior Wash", price: "$49", time: "45 min" },
  { id: "interior", name: "Interior Cleaning", price: "$69", time: "60 min" },
  { id: "full-detail", name: "Full Detail", price: "$149", time: "2-3 hours", popular: true },
];

const carTypes = [
  { id: "sedan", name: "Sedan", extra: "$0" },
  { id: "suv", name: "SUV / Crossover", extra: "+$15" },
  { id: "truck", name: "Truck / Van", extra: "+$25" },
  { id: "luxury", name: "Luxury / Sports", extra: "+$20" },
];

const timeSlots = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
];

const Booking = () => {
  const [searchParams] = useSearchParams();
  const initialService = searchParams.get("service") || "";
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    service: initialService,
    carType: "",
    date: "",
    time: "",
    address: "",
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    toast({
      title: "Booking Confirmed!",
      description: "We'll send you a confirmation email shortly.",
    });
    setStep(4);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.service && formData.carType;
      case 2:
        return formData.date && formData.time && formData.address;
      case 3:
        return formData.name && formData.email && formData.phone;
      default:
        return false;
    }
  };

  return (
    <Layout>
      {/* Header */}
      <section className="py-16 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display text-4xl md:text-5xl font-black text-background mb-4">
              Book Your <span className="text-primary">Wash</span>
            </h1>
            <p className="text-lg text-background/70">
              Schedule your premium car wash in just a few clicks
            </p>
          </motion.div>
        </div>
      </section>

      {/* Progress Bar */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 md:gap-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 md:gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold transition-all ${
                    step >= s
                      ? "bg-primary text-washero-charcoal"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
                <span className={`hidden md:block text-sm font-medium ${
                  step >= s ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {s === 1 ? "Service" : s === 2 ? "Schedule" : "Details"}
                </span>
                {s < 3 && (
                  <div className={`w-12 md:w-24 h-1 rounded ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form Content */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            {/* Step 1: Service Selection */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Select Your Service
                  </h2>
                  <div className="space-y-4">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleInputChange("service", service.id)}
                        className={`w-full p-6 rounded-xl border-2 text-left transition-all ${
                          formData.service === service.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-lg text-foreground">
                                {service.name}
                              </span>
                              {service.popular && (
                                <span className="px-2 py-0.5 bg-primary text-washero-charcoal text-xs font-semibold rounded">
                                  Popular
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="w-4 h-4" /> {service.time}
                            </span>
                          </div>
                          <span className="font-display text-2xl font-black text-primary">
                            {service.price}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Vehicle Type
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {carTypes.map((car) => (
                      <button
                        key={car.id}
                        type="button"
                        onClick={() => handleInputChange("carType", car.id)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          formData.carType === car.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Car className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <span className="font-semibold text-foreground block">
                          {car.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {car.extra}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Schedule */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Pick a Date
                  </h2>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange("date", e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="pl-12 h-14 text-lg"
                    />
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Select Time
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleInputChange("time", slot)}
                        className={`p-3 rounded-lg border-2 text-center font-medium transition-all ${
                          formData.time === slot
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                    Location
                  </h2>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Enter your address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="pl-12 h-14 text-lg"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Home, office, or any location with parking access
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Contact Details */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                  Your Details
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="h-14 text-lg mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="h-14 text-lg mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="h-14 text-lg mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="notes">Special Requests (Optional)</Label>
                    <Input
                      id="notes"
                      type="text"
                      placeholder="Any special instructions..."
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      className="h-14 text-lg mt-2"
                    />
                  </div>
                </div>

                {/* Order Summary */}
                <div className="p-6 rounded-xl bg-secondary mt-8">
                  <h3 className="font-display font-bold text-foreground mb-4">
                    Order Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium">
                        {services.find((s) => s.id === formData.service)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehicle</span>
                      <span className="font-medium">
                        {carTypes.find((c) => c.id === formData.carType)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date & Time</span>
                      <span className="font-medium">{formData.date} at {formData.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium truncate max-w-[200px]">{formData.address}</span>
                    </div>
                    <div className="border-t border-border pt-2 mt-2 flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-display font-bold text-primary text-lg">
                        {services.find((s) => s.id === formData.service)?.price}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-24 h-24 rounded-full bg-washero-eco/20 flex items-center justify-center mx-auto mb-8">
                  <CheckCircle className="w-12 h-12 text-washero-eco" />
                </div>
                <h2 className="font-display text-3xl font-black text-foreground mb-4">
                  Booking Confirmed!
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Thank you! We've sent a confirmation to {formData.email}.<br />
                  Our team will arrive at {formData.time} on {formData.date}.
                </p>
                <Button variant="hero" size="lg" asChild>
                  <Link to="/">Back to Home</Link>
                </Button>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            {step < 4 && (
              <div className="flex justify-between mt-12">
                {step > 1 ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </Button>
                ) : (
                  <div />
                )}
                
                {step < 3 ? (
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={() => setStep(step + 1)}
                    disabled={!canProceed()}
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!canProceed()}
                  >
                    Confirm Booking <CheckCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Booking;
