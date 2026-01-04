import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const planId = searchParams.get("plan");

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(planId ? `/suscripciones?plan=${planId}` : redirectTo);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate(planId ? `/suscripciones?plan=${planId}` : redirectTo);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo, planId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "¡Cuenta creada!",
          description: "Ya podés iniciar sesión.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        toast({
          title: "¡Bienvenido!",
          description: "Iniciaste sesión correctamente.",
        });
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      let message = "Error al procesar la solicitud";
      
      if (error.message?.includes("already registered")) {
        message = "Este email ya está registrado. Probá iniciar sesión.";
      } else if (error.message?.includes("Invalid login")) {
        message = "Email o contraseña incorrectos.";
      } else if (error.message?.includes("Email not confirmed")) {
        message = "Por favor confirmá tu email antes de iniciar sesión.";
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <section className="py-12 md:py-16 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md mx-auto"
          >
            <h1 className="font-display text-3xl md:text-4xl font-black text-background mb-2">
              {mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
            </h1>
            <p className="text-background/70">
              {planId 
                ? "Creá una cuenta para suscribirte a un plan" 
                : "Accedé a tu cuenta para gestionar tu suscripción"}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-md mx-auto"
          >
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-card">
              {/* Mode Toggle */}
              <div className="flex rounded-xl bg-muted p-1 mb-6">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    mode === "login"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    mode === "signup"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Registrarme
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <Label htmlFor="fullName" className="flex items-center gap-2 mb-1.5">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Nombre completo
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Juan Pérez"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                      required={mode === "signup"}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="email" className="flex items-center gap-2 mb-1.5">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="flex items-center gap-2 mb-1.5">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Contraseña
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {mode === "login" ? "Iniciando sesión..." : "Creando cuenta..."}
                    </>
                  ) : (
                    <>
                      {mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                {mode === "login" ? (
                  <>
                    ¿No tenés cuenta?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="text-primary font-medium hover:underline"
                    >
                      Registrate
                    </button>
                  </>
                ) : (
                  <>
                    ¿Ya tenés cuenta?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-primary font-medium hover:underline"
                    >
                      Iniciá sesión
                    </button>
                  </>
                )}
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
