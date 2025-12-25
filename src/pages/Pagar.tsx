import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Check, Upload, Loader2, CreditCard, Building, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PaymentIntent {
  id: string;
  booking_id: string | null;
  subscription_id: string | null;
  type: string;
  amount_ars: number;
  currency: string;
  status: string;
  proof_submitted: boolean;
  expires_at: string | null;
  created_at: string;
}

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string;
  service_name: string;
  car_type: string | null;
  booking_date: string;
  booking_time: string;
  address: string | null;
}

interface PaymentSettings {
  mp_alias: string;
  mp_payment_link: string;
  mp_cvu: string | null;
  mp_holder_name: string | null;
  account_holder_name: string | null;
  bank_name: string | null;
}

const formatPrice = (amountArs: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(amountArs);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export default function Pagar() {
  const { paymentIntentId } = useParams<{ paymentIntentId: string }>();
  const { toast } = useToast();
  
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedCvu, setCopiedCvu] = useState(false);
  
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofData, setProofData] = useState({
    payerName: '',
    reference: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!paymentIntentId) {
        setError('ID de pago no válido');
        setIsLoading(false);
        return;
      }

      try {
        // Fetch payment intent
        const { data: intentData, error: intentError } = await supabase
          .from('payment_intents')
          .select('*')
          .eq('id', paymentIntentId)
          .maybeSingle();

        if (intentError) throw intentError;
        if (!intentData) {
          setError('Enlace de pago no encontrado o expirado');
          setIsLoading(false);
          return;
        }

        setPaymentIntent(intentData);

        // Fetch booking if exists
        if (intentData.booking_id) {
          const { data: bookingData, error: bookingError } = await supabase
            .from('bookings')
            .select('id, customer_name, customer_email, service_name, car_type, booking_date, booking_time, address')
            .eq('id', intentData.booking_id)
            .maybeSingle();

          if (!bookingError && bookingData) {
            setBooking(bookingData);
          }
        }

        // Fetch payment settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('payment_settings')
          .select('mp_alias, mp_payment_link, mp_cvu, mp_holder_name, account_holder_name, bank_name')
          .eq('is_enabled', true)
          .maybeSingle();

        if (settingsError) throw settingsError;
        if (!settingsData) {
          setError('Configuración de pago no disponible');
          setIsLoading(false);
          return;
        }

        setPaymentSettings(settingsData);
      } catch (err: any) {
        console.error('Error fetching payment data:', err);
        setError('Error al cargar los datos de pago');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [paymentIntentId]);

  const handleCopy = async (text: string, type: 'alias' | 'cvu') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'alias') {
        setCopiedAlias(true);
        setTimeout(() => setCopiedAlias(false), 2000);
      } else {
        setCopiedCvu(true);
        setTimeout(() => setCopiedCvu(false), 2000);
      }
      toast({
        title: 'Copiado',
        description: `${type === 'alias' ? 'Alias' : 'CVU'} copiado al portapapeles`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo copiar',
      });
    }
  };

  const handleSubmitProof = async () => {
    if (!paymentIntentId) return;
    
    setIsSubmittingProof(true);
    try {
      // Insert payment proof
      const { error: proofError } = await supabase
        .from('payment_proofs')
        .insert({
          payment_intent_id: paymentIntentId,
          payer_name: proofData.payerName || null,
          reference: proofData.reference || null,
        });

      if (proofError) throw proofError;

      // Update payment intent to mark proof submitted
      const { error: updateError } = await supabase
        .from('payment_intents')
        .update({ proof_submitted: true })
        .eq('id', paymentIntentId);

      if (updateError) throw updateError;

      // Update local state
      setPaymentIntent(prev => prev ? { ...prev, proof_submitted: true } : null);
      setShowProofDialog(false);
      
      toast({
        title: '¡Gracias!',
        description: 'Recibimos tu aviso de pago. Te confirmaremos por email.',
      });
    } catch (err: any) {
      console.error('Error submitting proof:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el aviso de pago',
      });
    } finally {
      setIsSubmittingProof(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando datos de pago...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !paymentIntent || !paymentSettings) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {error || 'Página no encontrada'}
            </h1>
            <p className="text-muted-foreground mb-6">
              Este enlace de pago puede haber expirado o no ser válido.
            </p>
            <Button asChild>
              <Link to="/">Ir al Inicio</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const isPaid = paymentIntent.status === 'paid';
  const isExpired = paymentIntent.status === 'expired';
  const bookingRef = booking ? `WASHERO-${booking.id.substring(0, 8).toUpperCase()}` : `WASHERO-${paymentIntent.id.substring(0, 8).toUpperCase()}`;

  if (isPaid) {
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
            <h1 className="text-3xl font-bold text-foreground mb-2">¡Pago Confirmado!</h1>
            <p className="text-muted-foreground mb-6">
              Tu pago ya fue registrado. Gracias por elegir Washero.
            </p>
            <Button asChild>
              <Link to="/">Volver al Inicio</Link>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <section className="py-12 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-black text-background mb-2">
              Pagar con <span className="text-primary">MercadoPago</span>
            </h1>
            <p className="text-background/70">
              Referencia: <span className="font-mono font-bold">{bookingRef}</span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Payment Content */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto">
            {/* Amount Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary rounded-2xl p-8 text-center mb-8"
            >
              <p className="text-muted-foreground mb-2">Total a pagar</p>
              <p className="font-display text-5xl font-black text-foreground">
                {formatPrice(paymentIntent.amount_ars)}
              </p>
              {paymentIntent.type === 'subscription_monthly' && (
                <p className="text-sm text-muted-foreground mt-2">Pago mensual de suscripción</p>
              )}
            </motion.div>

            {/* Booking Details */}
            {booking && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-secondary rounded-xl p-6 mb-8"
              >
                <h3 className="font-semibold text-foreground mb-4">Tu Reserva</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Servicio</span>
                    <span className="font-medium">{booking.service_name}</span>
                  </div>
                  {booking.car_type && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehículo</span>
                      <span className="font-medium">{booking.car_type}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha</span>
                    <span className="font-medium capitalize">{formatDate(booking.booking_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horario</span>
                    <span className="font-medium">{booking.booking_time} hs</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Payment Methods */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Option 1: MP Link */}
              <div className="bg-white border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#009EE3]/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-[#009EE3]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Opción 1: Link de Pago</h3>
                    <p className="text-xs text-muted-foreground">Recomendado - Rápido y seguro</p>
                  </div>
                </div>
                <Button 
                  className="w-full bg-[#009EE3] hover:bg-[#007BB5] text-white"
                  size="lg"
                  asChild
                >
                  <a href={paymentSettings.mp_payment_link} target="_blank" rel="noopener noreferrer">
                    Pagar con MercadoPago →
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Ingresá el monto exacto: <strong>{formatPrice(paymentIntent.amount_ars)}</strong>
                </p>
              </div>

              {/* Option 2: Transfer */}
              <div className="bg-white border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Opción 2: Transferencia</h3>
                    <p className="text-xs text-muted-foreground">Desde tu banco o billetera</p>
                  </div>
                </div>
                
                {/* Alias */}
                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground">Alias</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="flex-1 bg-secondary rounded-lg px-4 py-3 font-mono text-lg font-semibold text-foreground">
                      {paymentSettings.mp_alias}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(paymentSettings.mp_alias, 'alias')}
                    >
                      {copiedAlias ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* CVU */}
                {paymentSettings.mp_cvu && (
                  <div className="mb-4">
                    <Label className="text-xs text-muted-foreground">CVU</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="flex-1 bg-secondary rounded-lg px-4 py-3 font-mono text-sm text-foreground">
                        {paymentSettings.mp_cvu}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(paymentSettings.mp_cvu!, 'cvu')}
                      >
                        {copiedCvu ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Holder info */}
                {(paymentSettings.account_holder_name || paymentSettings.mp_holder_name) && (
                  <p className="text-sm text-muted-foreground">
                    Titular: <strong>{paymentSettings.account_holder_name || paymentSettings.mp_holder_name}</strong>
                  </p>
                )}
              </div>

              {/* Reference Box */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Importante:</strong> Incluí esta referencia en el concepto de la transferencia:
                </p>
                <p className="font-mono font-bold text-yellow-900 text-lg mt-2">{bookingRef}</p>
              </div>

              {/* Already Paid Button */}
              {!paymentIntent.proof_submitted ? (
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => setShowProofDialog(true)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Ya realicé el pago
                </Button>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-medium">Aviso de pago enviado</p>
                  <p className="text-green-700 text-sm">Te confirmaremos por email cuando verifiquemos el pago.</p>
                </div>
              )}

              {/* Pay Later Link */}
              <div className="text-center pt-4">
                <Link to="/" className="text-sm text-muted-foreground hover:text-foreground underline">
                  Prefiero pagar después / en efectivo
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Proof Dialog */}
      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmación de Pago</DialogTitle>
            <DialogDescription>
              Contanos los detalles de tu transferencia para que podamos verificarla más rápido.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="payerName">Tu nombre (opcional)</Label>
              <Input
                id="payerName"
                placeholder="Nombre del titular de la cuenta"
                value={proofData.payerName}
                onChange={(e) => setProofData(prev => ({ ...prev, payerName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="reference">Referencia o últimos 4 dígitos (opcional)</Label>
              <Input
                id="reference"
                placeholder="Ej: 1234 o número de operación"
                value={proofData.reference}
                onChange={(e) => setProofData(prev => ({ ...prev, reference: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProofDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitProof} disabled={isSubmittingProof}>
              {isSubmittingProof ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Confirmar Pago'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}