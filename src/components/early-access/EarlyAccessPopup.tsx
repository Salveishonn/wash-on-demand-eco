import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Sparkles } from "lucide-react";

const STORAGE_KEY = "washero_early_access_shown";

export const EarlyAccessPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    // Check if popup was already shown
    const wasShown = localStorage.getItem(STORAGE_KEY);
    if (!wasShown) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error("Por favor completá todos los campos");
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the edge function which handles DB insert + email
      const { data, error } = await supabase.functions.invoke("early-access-signup", {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        },
      });

      if (error) throw error;

      setIsSuccess(true);
      localStorage.setItem(STORAGE_KEY, "true");
      toast.success("✅ Listo. Te enviamos un email confirmando tu 20% OFF.");
    } catch (error) {
      console.error("Error submitting early access lead:", error);
      toast.error("Hubo un error. Por favor intentá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-background border-border/50 shadow-xl">
        {!isSuccess ? (
          <>
            <DialogHeader className="space-y-3 pb-2">
              <DialogTitle className="text-2xl font-bold text-foreground text-left">
                Washero llega en abril 🚗✨
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-base leading-relaxed max-w-[90%]">
                Todavía no estamos operando, pero estamos preparando el mejor servicio de lavado premium a domicilio en Zona Norte.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-5 my-2">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-foreground leading-snug">
                    Dejanos tus datos y accedé a un{" "}
                    <span className="text-primary font-bold text-lg">20% de descuento</span>{" "}
                    exclusivo para el lanzamiento.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  placeholder="Tu nombre"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+54 9 11 1234-5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Enviando..." : "Acceder al 20% OFF"}
              </Button>
            </form>
          </>
        ) : (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <DialogTitle className="text-2xl font-bold text-foreground">
              ¡Listo!
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-base leading-relaxed">
              Te vamos a avisar antes que a nadie cuando abramos la agenda en abril.
              <br />
              <span className="font-medium text-primary">Tu descuento queda reservado.</span>
            </DialogDescription>
            <Button 
              onClick={handleClose}
              className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              ¡Genial!
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
