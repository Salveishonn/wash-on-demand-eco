import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';

export default function PagoExito() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const type = searchParams.get('type') || 'booking';

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">¡Pago Exitoso!</h1>
          <p className="text-muted-foreground mb-6">
            {type === 'subscription'
              ? 'Tu suscripción fue activada. ¡Ya podés agendar tus lavados!'
              : 'Tu pago fue procesado correctamente. Te enviamos la confirmación por email.'}
          </p>
          {ref && (
            <p className="text-sm text-muted-foreground mb-4">
              Referencia: <span className="font-mono font-semibold">{ref.substring(0, 8).toUpperCase()}</span>
            </p>
          )}
          <div className="flex gap-4 justify-center">
            <Button variant="hero" size="lg" asChild>
              <Link to="/">Volver al Inicio</Link>
            </Button>
            {type === 'booking' && (
              <Button variant="outline" size="lg" asChild>
                <Link to="/reservar">Nueva Reserva</Link>
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
