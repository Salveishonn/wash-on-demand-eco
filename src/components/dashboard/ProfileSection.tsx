import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, User } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileData {
  full_name: string;
  last_name: string;
  email: string;
  phone: string;
  dni: string;
  gender: string;
  birth_date: string;
  work_address: string;
}

interface ProfileSectionProps {
  userId: string;
  userEmail: string;
}

export function ProfileSection({ userId, userEmail }: ProfileSectionProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ProfileData>({
    full_name: "",
    last_name: "",
    email: "",
    phone: "",
    dni: "",
    gender: "",
    birth_date: "",
    work_address: "",
  });

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, last_name, email, phone, dni, gender, birth_date, work_address")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setForm({
          full_name: data.full_name || "",
          last_name: (data as any).last_name || "",
          email: data.email || userEmail || "",
          phone: data.phone || "",
          dni: (data as any).dni || "",
          gender: (data as any).gender || "",
          birth_date: (data as any).birth_date || "",
          work_address: (data as any).work_address || "",
        });
      } else {
        setForm(prev => ({ ...prev, email: userEmail }));
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast({ variant: "destructive", title: "Nombre requerido" });
      return;
    }
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const profilePayload = {
        full_name: form.full_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        dni: form.dni.trim(),
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        work_address: form.work_address.trim() || null,
      } as any;

      if (existing) {
        const { error } = await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .insert({ ...profilePayload, user_id: userId });
        if (error) throw error;
      }

      toast({ title: "Perfil guardado", description: "Tus datos se actualizaron correctamente." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Required fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Nombre *</Label>
          <Input
            placeholder="Juan"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Apellido</Label>
          <Input
            placeholder="Pérez"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Email *</Label>
          <Input
            type="email"
            placeholder="juan@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Teléfono *</Label>
          <Input
            placeholder="+54 9 11 1234-5678"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>

      {/* Optional fields */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Información adicional</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">DNI</Label>
            <Input
              placeholder="12.345.678"
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Género</Label>
            <Select value={form.gender} onValueChange={(val) => setForm({ ...form, gender: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="femenino">Femenino</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
                <SelectItem value="prefiero_no_decir">Prefiero no decir</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <Label className="text-sm font-medium">Fecha de nacimiento</Label>
            <Input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Dirección de trabajo</Label>
            <Input
              placeholder="Av. Corrientes 1234"
              value={form.work_address}
              onChange={(e) => setForm({ ...form, work_address: e.target.value })}
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar cambios
      </Button>
    </div>
  );
}
