import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail } from 'lucide-react';
import washeroLogo from '@/assets/washero-logo.jpeg';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        toast({
          variant: 'destructive',
          title: 'Error de autenticación',
          description: error.message === 'Invalid login credentials' 
            ? 'Email o contraseña incorrectos' 
            : error.message,
        });
        return;
      }

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

          {/* Login Form */}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isLoading}
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
