import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Copy, Loader2, Eye, EyeOff } from 'lucide-react';

interface Keys {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_BUCKET: string;
  TRANSCODER_SHARED_SECRET: string;
}

export function RenderKeysReveal() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<Keys | null>(null);
  const [show, setShow] = useState<Record<string, boolean>>({});

  const reveal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reveal-service-key', {
        body: {},
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'No autorizado');
      setKeys({
        SUPABASE_URL: data.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: data.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_BUCKET: data.SUPABASE_BUCKET,
        TRANSCODER_SHARED_SECRET: data.TRANSCODER_SHARED_SECRET,
      });
      setOpen(true);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'No se pudieron obtener las keys',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = (label: string, val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: 'Copiado', description: label });
  };

  const rows: { label: keyof Keys; secret: boolean }[] = [
    { label: 'SUPABASE_URL', secret: false },
    { label: 'SUPABASE_SERVICE_ROLE_KEY', secret: true },
    { label: 'SUPABASE_BUCKET', secret: false },
    { label: 'TRANSCODER_SHARED_SECRET', secret: true },
  ];

  return (
    <>
      <Alert className="mb-2 border-amber-300 bg-amber-50">
        <KeyRound className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-900 text-sm">Configurar Render (temporal)</AlertTitle>
        <AlertDescription className="text-xs text-amber-800 flex items-center justify-between gap-2">
          <span>Revelá las variables para pegar en el dashboard de Render.</span>
          <Button size="sm" variant="outline" onClick={reveal} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <KeyRound className="w-3 h-3 mr-1" />}
            Revelar keys
          </Button>
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Variables para Render</DialogTitle>
            <DialogDescription>
              Pegá estas variables en Render → Environment → Save → esperá redeploy automático.
              Después avisame y borramos esta función.
            </DialogDescription>
          </DialogHeader>
          {keys && (
            <div className="space-y-2">
              {rows.map(({ label, secret }) => {
                const val = keys[label];
                const visible = !secret || show[label];
                return (
                  <div key={label} className="border rounded-md p-2 bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-xs font-semibold">{label}</code>
                      <div className="flex gap-1">
                        {secret && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setShow((s) => ({ ...s, [label]: !s[label] }))}
                          >
                            {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => copy(label, val)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs font-mono break-all text-muted-foreground">
                      {visible ? val : '•'.repeat(Math.min(val.length, 40))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
