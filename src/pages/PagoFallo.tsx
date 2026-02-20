import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';

export default function PagoFallo() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Pago No Procesado</h1>
          <p className="text-muted-foreground mb-6">
            El pago no pudo ser completado. Podés intentar nuevamente o elegir otro método de pago.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="hero" size="lg" asChild>
              <Link to="/reservar">Intentar Nuevamente</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/contacto">Contactar</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
