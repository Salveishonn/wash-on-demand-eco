import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Servicios from "./pages/Servicios";
import ComoFunciona from "./pages/ComoFunciona";
import Sustentabilidad from "./pages/Sustentabilidad";
import Nosotros from "./pages/Nosotros";
import Reservar from "./pages/Reservar";
import PreguntasFrecuentes from "./pages/PreguntasFrecuentes";
import Contacto from "./pages/Contacto";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/servicios" element={<Servicios />} />
          <Route path="/como-funciona" element={<ComoFunciona />} />
          <Route path="/sustentabilidad" element={<Sustentabilidad />} />
          <Route path="/nosotros" element={<Nosotros />} />
          <Route path="/reservar" element={<Reservar />} />
          <Route path="/preguntas-frecuentes" element={<PreguntasFrecuentes />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
