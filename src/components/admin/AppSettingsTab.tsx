import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface AppSetting {
  id: string;
  key: string;
  value: string;
  type: string;
  description: string | null;
}

export function AppSettingsTab() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .order('key');
    if (error) {
      toast.error('Error al cargar configuración');
    } else {
      setSettings(data || []);
      const vals: Record<string, string> = {};
      (data || []).forEach(s => { vals[s.key] = s.value; });
      setEditValues(vals);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (setting: AppSetting) => {
    const newValue = editValues[setting.key];
    if (newValue === setting.value) return;

    setSavingKey(setting.key);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('id', setting.id);

    if (error) {
      toast.error(`Error al guardar ${setting.key}`);
    } else {
      toast.success(`${setting.key} actualizado`);
      await fetchSettings();
    }
    setSavingKey(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Configuración de la App</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Estos valores controlan el comportamiento del sistema. Los cambios se aplican de inmediato.
      </p>

      <div className="grid gap-4">
        {settings.map(setting => (
          <div key={setting.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold text-foreground">{setting.key}</Label>
                {setting.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={editValues[setting.key] === setting.value || savingKey === setting.key}
                onClick={() => handleSave(setting)}
                className="h-8"
              >
                {savingKey === setting.key ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>

            {setting.type === 'boolean' ? (
              <Switch
                checked={editValues[setting.key] === 'true'}
                onCheckedChange={(checked) =>
                  setEditValues(prev => ({ ...prev, [setting.key]: checked ? 'true' : 'false' }))
                }
              />
            ) : (
              <Input
                value={editValues[setting.key] || ''}
                onChange={(e) =>
                  setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))
                }
                type={setting.type === 'number' ? 'number' : 'text'}
                className="max-w-xs"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
