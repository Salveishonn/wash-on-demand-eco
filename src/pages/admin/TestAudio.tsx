import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type TraceAudio = {
  id: string;
  created_at: string;
  media_storage_path: string | null;
  playable_media_storage_path: string | null;
  media_mime_type: string | null;
  playable_media_mime_type: string | null;
  media_transcode_status: string | null;
  signed_url: string | null;
  signed_url_expires_at: string;
  bucket: string;
  storage?: { exists?: boolean; size?: number | null; mime_type?: string | null };
  server_fetch?: { status?: number; content_type?: string | null; content_length?: string | null };
  validations?: Record<string, boolean>;
};

export default function TestAudio() {
  const [audios, setAudios] = useState<TraceAudio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.functions.invoke('admin-audio-trace')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;
        setAudios((data as any)?.audios || []);
      })
      .catch(async (err: any) => {
        if (cancelled) return;
        if (err?.context instanceof Response) {
          const body = await err.context.text().catch(() => '');
          setError(`${err.message}${body ? ` — ${body}` : ''}`);
        } else {
          setError(err?.message || String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground p-4 space-y-4">
      <h1 className="text-xl font-semibold">Native WhatsApp audio trace</h1>
      {loading && <p>Loading latest transcoded audios…</p>}
      {error && <pre className="whitespace-pre-wrap text-sm text-destructive">{error}</pre>}
      {!loading && !error && audios.length === 0 && <p>No transcoded audios found.</p>}

      {audios.map((audio) => (
        <section key={audio.id} className="space-y-2 border border-border p-3">
          <div className="text-xs font-mono break-all space-y-1">
            <div>id: {audio.id}</div>
            <div>bucket: {audio.bucket}</div>
            <div>db path: {audio.playable_media_storage_path}</div>
            <div>original path: {audio.media_storage_path}</div>
            <div>mime: {audio.playable_media_mime_type}</div>
            <div>signed url expires: {audio.signed_url_expires_at}</div>
            <div>signed url: {audio.signed_url}</div>
            <div>storage: {JSON.stringify(audio.storage)}</div>
            <div>server fetch: {JSON.stringify(audio.server_fetch)}</div>
            <div>validations: {JSON.stringify(audio.validations)}</div>
          </div>

          {audio.signed_url && (
            <audio controls playsInline preload="metadata">
              <source src={audio.signed_url} type="audio/mp4" />
            </audio>
          )}
        </section>
      ))}
    </main>
  );
}