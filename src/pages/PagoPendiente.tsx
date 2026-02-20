import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';

export default function PagoPendiente() {
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
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Pago Pendiente</h1>
          <p className="text-muted-foreground mb-6">
            Tu pago está siendo procesado. Te notificaremos por email cuando se confirme.
          </p>
          {ref && (
            <p className="text-sm text-muted-foreground mb-4">
              Referencia: <span className="font-mono font-semibold">{ref.substring(0, 8).toUpperCase()}</span>
            </p>
          )}
          <Button variant="hero" size="lg" asChild>
            <Link to="/">Volver al Inicio</Link>
          </Button>
        </motion.div>
      </div>
    </Layout>
  );
}
