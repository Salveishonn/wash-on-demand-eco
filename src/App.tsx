import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import Index from "./pages/Index";
import Servicios from "./pages/Servicios";
import ComoFunciona from "./pages/ComoFunciona";
import Sustentabilidad from "./pages/Sustentabilidad";
import Nosotros from "./pages/Nosotros";
import Reservar from "./pages/Reservar";
import PreguntasFrecuentes from "./pages/PreguntasFrecuentes";
import Contacto from "./pages/Contacto";
import ReservaConfirmada from "./pages/ReservaConfirmada";
import Suscripciones from "./pages/Suscripciones";
import SuscripcionConfirmada from "./pages/SuscripcionConfirmada";
import KipperSeguros from "./pages/KipperSeguros";
import Pagar from "./pages/Pagar";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/servicios" element={<Servicios />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/sustentabilidad" element={<Sustentabilidad />} />
            <Route path="/nosotros" element={<Nosotros />} />
            <Route path="/reservar" element={<Reservar />} />
            <Route path="/preguntas-frecuentes" element={<PreguntasFrecuentes />} />
            <Route path="/contacto" element={<Contacto />} />
            <Route path="/reserva-confirmada" element={<ReservaConfirmada />} />
            <Route path="/suscripciones" element={<Suscripciones />} />
            <Route path="/suscripcion-confirmada" element={<SuscripcionConfirmada />} />
            <Route path="/kipper-seguros" element={<KipperSeguros />} />
            <Route path="/pagar/:paymentIntentId" element={<Pagar />} />
            
            {/* Legal Pages for Meta Compliance */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            
            {/* Auth Routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
