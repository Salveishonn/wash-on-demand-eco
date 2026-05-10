import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AudioPlayer } from '@/components/ui/audio-player';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';

interface DiagResult {
  config: Record<string, any>;
  checks: Record<string, any>;
  recent_audios: any[];
}

const Status = ({ ok }: { ok: boolean | null | undefined }) =>
  ok === true ? (
    <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
  ) : ok === false ? (
    <XCircle className="w-4 h-4 text-red-600 inline" />
  ) : (
    <span className="w-4 h-4 inline-block rounded-full bg-muted" />
  );

export default function AudioDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [data, setData] = useState<DiagResult | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-audio-diagnostics');
      if (error) throw error;
      setData(data as DiagResult);
    } catch (e: any) {
      toast.error('Diagnóstico falló: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const repair = async () => {
    setRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-repair-whatsapp-audio', {
        body: { limit: 50 },
      });
      if (error) throw error;
      toast.success(`Reparados: ${(data as any)?.processed || 0}`);
      await run();
    } catch (e: any) {
      toast.error('Reparación falló: ' + e.message);
    } finally {
      setRepairing(false);
    }
  };

  const playableUrl = (path?: string | null) =>
    path ? supabase.storage.from('whatsapp-media').getPublicUrl(path).data.publicUrl : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Diagnóstico de audio WhatsApp</h1>
        <div className="flex gap-2">
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Correr diagnóstico
          </Button>
          <Button variant="outline" onClick={repair} disabled={repairing}>
            {repairing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wrench className="w-4 h-4 mr-2" />}
            Reparar audios fallidos
          </Button>
        </div>
      </div>

      {!data && <p className="text-sm text-muted-foreground">Hacé click en "Correr diagnóstico".</p>}

      {data && (
        <>
          <Card className="p-4 space-y-2">
            <h2 className="font-semibold">Configuración</h2>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(data.config, null, 2)}</pre>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Checks</h2>
            {Object.entries(data.checks).map(([k, v]: any) => (
              <div key={k} className="text-sm border-b pb-2">
                <div className="flex items-center gap-2">
                  <Status ok={v?.ok} />
                  <span className="font-mono">{k}</span>
                </div>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(v, null, 2)}</pre>
              </div>
            ))}
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Últimos 10 audios</h2>
            {data.recent_audios.map((m: any) => (
              <div key={m.id} className="border rounded p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-mono">{m.id.slice(0, 8)} · {new Date(m.created_at).toLocaleString('es-AR')}</span>
                  <span>
                    {m.media_transcode_status === 'success' ? '✅' : m.media_transcode_status === 'failed' ? '❌' : '—'}{' '}
                    {m.media_transcode_status || 'n/a'}
                  </span>
                </div>
                <div>orig: <code>{m.media_storage_path || '—'}</code></div>
                <div>playable: <code>{m.playable_media_storage_path || '—'}</code> ({m.playable_media_mime_type || '—'})</div>
                {m.media_transcode_error && <div className="text-red-600">err: {m.media_transcode_error}</div>}
                {(m.playable_media_storage_path || m.media_storage_path) && (
                  <AudioPlayer
                    url={playableUrl(m.playable_media_storage_path || m.media_storage_path)}
                    mime={m.playable_media_mime_type || m.media_mime_type}
                    storagePath={m.playable_media_storage_path || m.media_storage_path}
                  />
                )}
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
