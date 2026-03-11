import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import washeroLogo from '@/assets/washero-logo.jpeg';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimer, setBlockTimer] = useState(0);

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState('');

  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/admin';

  // Countdown timer for blocked state
  useEffect(() => {
    if (blockTimer > 0) {
      const interval = setInterval(() => {
        setBlockTimer(prev => {
          if (prev <= 1) {
            setIsBlocked(false);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [blockTimer]);

  const logAttempt = async (success: boolean) => {
    try {
      await supabase.functions.invoke('log-login-attempt', {
        body: { email, success },
      });
    } catch (e) {
      // Non-critical
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBlocked) {
      toast({
        variant: 'destructive',
        title: 'Cuenta bloqueada',
        description: `Demasiados intentos. Esperá ${blockTimer}s.`,
      });
      return;
    }

    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ingresá email y contraseña',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        console.error('Login error:', error);
        await logAttempt(false);
        
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= 5) {
          setIsBlocked(true);
          setBlockTimer(900); // 15 minutes
          toast({
            variant: 'destructive',
            title: 'Cuenta bloqueada',
            description: 'Demasiados intentos fallidos. Esperá 15 minutos.',
          });
          return;
        }

        toast({
          variant: 'destructive',
          title: 'Error de autenticación',
          description: error.message === 'Invalid login credentials' 
            ? `Email o contraseña incorrectos (${5 - newAttempts} intentos restantes)` 
            : error.message,
        });
        return;
      }

      // Check for MFA enrollment
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = factorsData?.totp || [];
      const verifiedFactor = totpFactors.find(f => f.status === 'verified');

      if (verifiedFactor) {
        // MFA required - create challenge
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: verifiedFactor.id,
        });

        if (challengeError) {
          throw challengeError;
        }

        setMfaFactorId(verifiedFactor.id);
        setMfaChallengeId(challengeData.id);
        setMfaStep(true);
        setIsLoading(false);
        return;
      }

      // No MFA - proceed
      await logAttempt(true);
      toast({
        title: '¡Bienvenido!',
        description: 'Accediendo al panel de administración...',
      });
      navigate(from, { replace: true });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Error al iniciar sesión',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Código inválido',
          description: 'El código de verificación es incorrecto.',
        });
        setIsLoading(false);
        return;
      }

      await logAttempt(true);
      toast({
        title: '¡Bienvenido!',
        description: 'Verificación exitosa.',
      });
      navigate(from, { replace: true });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Error al verificar código',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-washero-charcoal p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-background rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src={washeroLogo}
              alt="Washero"
              className="w-20 h-20 rounded-xl mx-auto mb-4 object-cover"
            />
            <h1 className="font-display text-2xl font-black text-foreground">
              Panel Admin
            </h1>
            <p className="text-muted-foreground mt-1">
              Acceso restringido a administradores
            </p>
          </div>

          {mfaStep ? (
            /* MFA Verification Form */
            <form onSubmit={handleMfaVerify} className="space-y-6">
              <div className="text-center mb-4">
                <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Ingresá el código de tu app de autenticación
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Código de verificación</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="h-12 text-center text-2xl tracking-widest"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isLoading || mfaCode.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verificando...
                  </>
                ) : (
                  'Verificar'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setMfaStep(false);
                  setMfaCode('');
                }}
              >
                Volver
              </Button>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@washero.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    disabled={isLoading || isBlocked}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                    disabled={isLoading || isBlocked}
                  />
                </div>
              </div>

              {isBlocked && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive text-center">
                    🔒 Cuenta bloqueada. Reintentar en {Math.floor(blockTimer / 60)}:{(blockTimer % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              )}

              {failedAttempts > 0 && !isBlocked && (
                <p className="text-sm text-muted-foreground text-center">
                  {5 - failedAttempts} intentos restantes
                </p>
              )}

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isLoading || isBlocked}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verificando...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-muted-foreground hover:text-primary">
              ← Volver al sitio
            </a>
          </div>
        </div>

        <p className="text-center text-sm text-background/50 mt-6">
          Solo usuarios autorizados pueden acceder
        </p>
      </motion.div>
    </div>
  );
}
