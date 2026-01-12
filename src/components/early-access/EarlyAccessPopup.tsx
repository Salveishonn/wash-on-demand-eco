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
      const { error } = await supabase
        .from("early_access_leads")
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        });

      if (error) throw error;

      setIsSuccess(true);
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (error) {
      console.error("Error submitting early access lead:", error);
      toast.error("Hubo un error. Por favor intentá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-background border-primary/20">
        {!isSuccess ? (
          <>
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
                Washero llega en abril 🚗✨
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-4 text-base leading-relaxed">
                Todavía no estamos operando, pero estamos preparando el mejor servicio de lavado premium a domicilio en Zona Norte.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-4">
              <p className="text-center text-foreground font-medium flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Dejanos tus datos y accedé a un <span className="text-primary font-bold">20% de descuento exclusivo</span> para el lanzamiento.
              </p>
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
