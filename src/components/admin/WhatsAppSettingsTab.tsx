import { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Send,
  Phone,
  Settings,
  Copy,
  ExternalLink,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface WhatsAppConfig {
  provider: 'meta' | 'twilio' | 'none';
  metaConfigured: boolean;
  twilioConfigured: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  lastWebhook?: string;
  lastOutbound?: string;
  templatesConfigured: string[];
}

interface HealthStatus {
  webhookActive: boolean;
  lastWebhookAt: string | null;
  lastMessageAt: string | null;
  lastMessageStatus: string | null;
  pendingMessages: number;
}

const REQUIRED_TEMPLATES = [
  { name: 'washero_booking_confirmed', description: 'Confirmación de reserva' },
  { name: 'washero_on_the_way', description: 'En camino al cliente' },
  { name: 'washero_booking_accepted', description: 'Reserva aceptada' },
  { name: 'washero_subscription_purchased', description: 'Suscripción activada' },
];

export function WhatsAppSettingsTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
  const verifyToken = 'washero_whatsapp_verify_2025';

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      // Get last webhook log
      const { data: webhookLogs } = await supabase
        .from('webhook_logs')
        .select('created_at, event_type')
        .eq('source', 'meta-whatsapp')
        .order('created_at', { ascending: false })
        .limit(1);

      // Get last outgoing message
      const { data: lastMessage } = await supabase
        .from('whatsapp_messages')
        .select('created_at, status, direction')
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1);

      // Get pending outbox count
      const { count: pendingCount } = await supabase
        .from('whatsapp_outbox')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');

      // Get active templates
      const { data: templates } = await supabase
        .from('whatsapp_templates')
        .select('name')
        .eq('is_active', true);

      setConfig({
        provider: 'meta', // Default since we're using Meta as primary
        metaConfigured: true, // Assumed from secrets
        twilioConfigured: false,
        templatesConfigured: templates?.map(t => t.name) || [],
      });

      setHealth({
        webhookActive: webhookLogs && webhookLogs.length > 0,
        lastWebhookAt: webhookLogs?.[0]?.created_at || null,
        lastMessageAt: lastMessage?.[0]?.created_at || null,
        lastMessageStatus: lastMessage?.[0]?.status || null,
        pendingMessages: pendingCount || 0,
      });
    } catch (error) {
      console.error('Error fetching WhatsApp config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Ingresá un número de teléfono' });
      return;
    }

    setIsTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No hay sesión activa');
      }

      // Create a test conversation if needed, then send
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-whatsapp-send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: testPhone,
            body: '🧪 Test desde Washero Admin - WhatsApp funcionando correctamente!',
          }),
        }
      );

      const result = await response.json();

      if (result.ok) {
        toast({
          title: 'Test enviado ✅',
          description: `Mensaje enviado vía ${result.provider || 'WhatsApp'}`,
        });
        fetchConfig();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo enviar el test',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado', description: `${label} copiado al portapapeles` });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            Configuración WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            Meta Cloud API - Número: +54 9 11 2679 9335
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchConfig}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Status Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Provider Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Proveedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={config?.metaConfigured ? 'default' : 'destructive'} className="bg-green-500">
                Meta Cloud API
              </Badge>
              {config?.metaConfigured ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Twilio: {config?.twilioConfigured ? 'Disponible como fallback' : 'No configurado'}
            </p>
          </CardContent>
        </Card>

        {/* Webhook Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {health?.webhookActive ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-yellow-500" />
              )}
              Webhook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={health?.webhookActive ? 'default' : 'secondary'}>
              {health?.webhookActive ? 'Activo' : 'Sin actividad reciente'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Último: {formatDate(health?.lastWebhookAt)}
            </p>
          </CardContent>
        </Card>

        {/* Last Message */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Send className="w-4 h-4" />
              Último mensaje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge 
              variant={health?.lastMessageStatus === 'sent' || health?.lastMessageStatus === 'delivered' ? 'default' : 'secondary'}
              className={health?.lastMessageStatus === 'failed' ? 'bg-red-500' : ''}
            >
              {health?.lastMessageStatus || 'Sin mensajes'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {formatDate(health?.lastMessageAt)}
            </p>
            {health?.pendingMessages && health.pendingMessages > 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                {health.pendingMessages} mensajes pendientes
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />
            Configuración del Webhook
          </CardTitle>
          <CardDescription>
            Usá estos datos en Meta Business Manager para conectar el webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL del Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl, 'URL')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Verify Token</Label>
            <div className="flex gap-2">
              <Input value={verifyToken} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(verifyToken, 'Token')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Campos a suscribir</AlertTitle>
            <AlertDescription>
              En Meta Business Manager, suscribí: <code>messages</code>, <code>message_status</code>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Templates Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plantillas Requeridas</CardTitle>
          <CardDescription>
            Estas plantillas deben estar aprobadas en Meta Business Manager
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {REQUIRED_TEMPLATES.map((template) => {
              const isConfigured = config?.templatesConfigured.includes(template.name);
              return (
                <div key={template.name} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <code className="text-sm font-mono">{template.name}</code>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                  {isConfigured ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Test Send */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Enviar Test
          </CardTitle>
          <CardDescription>
            Enviá un mensaje de prueba para verificar la configuración
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="+54 9 11 XXXX XXXX"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleTestSend} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Test
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            El mensaje se enviará usando Meta Cloud API como mensaje de texto libre
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
