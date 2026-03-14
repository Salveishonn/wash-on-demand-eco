import { useState, useRef } from 'react';
import { Camera, Image, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface JobPhotoUploadProps {
  bookingId: string;
  type: 'before' | 'after';
}

export default function JobPhotoUpload({ bookingId, type }: JobPhotoUploadProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${bookingId}/${type}/${Date.now()}.${ext}`;
        
        const { error } = await supabase.storage
          .from('booking-photos')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (!error) {
          const { data: urlData } = supabase.storage
            .from('booking-photos')
            .getPublicUrl(path);
          setPhotos(prev => [...prev, urlData.publicUrl]);
        }
      }
    } catch (err) {
      console.error('[PhotoUpload] Error:', err);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Fotos {type === 'before' ? 'Antes' : 'Después'}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          {uploading ? 'Subiendo...' : 'Tomar foto'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleCapture}
        />
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <div key={i} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border">
              <img src={url} alt={`${type} ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Image className="w-3.5 h-3.5" />
          <span>Sin fotos aún</span>
        </div>
      )}
    </div>
  );
}
