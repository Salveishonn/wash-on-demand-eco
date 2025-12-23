import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Phone,
  Mail,
  Car,
  Calendar,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  Gift,
  Filter,
  Eye,
  Edit2,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import kipperLogo from "@/assets/kipper-logo.png";

interface KipperLead {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  vehicle_type: string | null;
  booking_id: string | null;
  source: string;
  status: string;
  notes: string | null;
  kipper_benefit_applied: boolean;
  benefit_type: string | null;
  benefit_value: string | null;
  created_at: string;
  updated_at: string;
}

type StatusFilter = "all" | "new" | "contacted" | "converted" | "not_interested";

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function KipperLeadsTab() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<KipperLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedLead, setSelectedLead] = useState<KipperLead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editBenefitApplied, setEditBenefitApplied] = useState(false);
  const [editBenefitType, setEditBenefitType] = useState("");
  const [editBenefitValue, setEditBenefitValue] = useState("");

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("kipper_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err: any) {
      console.error("[KipperLeadsTab] Fetch error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los leads",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const openDetail = (lead: KipperLead) => {
    setSelectedLead(lead);
    setEditStatus(lead.status);
    setEditNotes(lead.notes || "");
    setEditBenefitApplied(lead.kipper_benefit_applied);
    setEditBenefitType(lead.benefit_type || "");
    setEditBenefitValue(lead.benefit_value || "");
    setIsEditing(false);
    setIsDetailOpen(true);
  };

  const handleSave = async () => {
    if (!selectedLead) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("kipper_leads")
        .update({
          status: editStatus,
          notes: editNotes || null,
          kipper_benefit_applied: editBenefitApplied,
          benefit_type: editBenefitApplied ? editBenefitType || null : null,
          benefit_value: editBenefitApplied ? editBenefitValue || null : null,
        })
        .eq("id", selectedLead.id);

      if (error) throw error;

      toast({
        title: "Lead actualizado",
        description: "Los cambios se guardaron correctamente",
      });

      setIsEditing(false);
      setIsDetailOpen(false);
      fetchLeads();
    } catch (err: any) {
      console.error("[KipperLeadsTab] Update error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el lead",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (statusFilter === "all") return true;
    return lead.status === statusFilter;
  });

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    converted: leads.filter((l) => l.status === "converted").length,
    notInterested: leads.filter((l) => l.status === "not_interested").length,
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      converted: "bg-green-100 text-green-800",
      not_interested: "bg-gray-100 text-gray-800",
    };
    const labels: Record<string, string> = {
      new: "Nuevo",
      contacted: "Contactado",
      converted: "Convertido",
      not_interested: "Sin interés",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          styles[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {labels[status] || status}
      </span>
    );
  };

  const getSourceBadge = (source: string) => {
    const labels: Record<string, string> = {
      booking: "Reserva",
      confirmation: "Confirmación",
      subscription: "Suscripciones",
    };
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#8B1E2F]/10 text-[#8B1E2F]">
        {labels[source] || source}
      </span>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <img src={kipperLogo} alt="Kipper" className="w-10 h-10 object-contain" />
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Leads Kipper Seguros
          </h2>
          <p className="text-sm text-muted-foreground">
            Clientes interesados en cotización de seguros
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-background rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#8B1E2F]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#8B1E2F]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-background rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.new}</p>
              <p className="text-xs text-muted-foreground">Nuevos</p>
            </div>
          </div>
        </div>
        <div className="bg-background rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.contacted}</p>
              <p className="text-xs text-muted-foreground">Contactados</p>
            </div>
          </div>
        </div>
        <div className="bg-background rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.converted}</p>
              <p className="text-xs text-muted-foreground">Convertidos</p>
            </div>
          </div>
        </div>
        <div className="bg-background rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.notInterested}</p>
              <p className="text-xs text-muted-foreground">Sin interés</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        {(["all", "new", "contacted", "converted", "not_interested"] as StatusFilter[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                statusFilter === status
                  ? "bg-[#8B1E2F] text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {status === "all"
                ? "Todos"
                : status === "new"
                ? "Nuevos"
                : status === "contacted"
                ? "Contactados"
                : status === "converted"
                ? "Convertidos"
                : "Sin interés"}
            </button>
          )
        )}
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Vehículo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Fuente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Beneficio
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Cargando...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No hay leads
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <p className="font-medium text-sm">{lead.customer_name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <a
                          href={`tel:${lead.customer_phone}`}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {lead.customer_phone}
                        </a>
                        <a
                          href={`mailto:${lead.customer_email}`}
                          className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" />
                          {lead.customer_email}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-muted-foreground">
                        {lead.vehicle_type || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{getSourceBadge(lead.source)}</td>
                    <td className="px-4 py-4">{getStatusBadge(lead.status)}</td>
                    <td className="px-4 py-4">
                      {lead.kipper_benefit_applied ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                          <Gift className="w-3 h-3" />
                          Aplicado
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm">{formatDateTime(lead.created_at)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDetail(lead)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#8B1E2F]" />
              Lead Kipper Seguros
            </DialogTitle>
            <DialogDescription>
              {selectedLead?.customer_name}
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              {/* Contact Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-3">Contacto</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`tel:${selectedLead.customer_phone}`}
                      className="text-primary hover:underline"
                    >
                      {selectedLead.customer_phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`mailto:${selectedLead.customer_email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedLead.customer_email}
                    </a>
                  </div>
                  {selectedLead.vehicle_type && (
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedLead.vehicle_type}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{formatDateTime(selectedLead.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Status & Notes */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Estado y Notas</h4>
                  {!isEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Estado</Label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Nuevo</SelectItem>
                          <SelectItem value="contacted">Contactado</SelectItem>
                          <SelectItem value="converted">Convertido</SelectItem>
                          <SelectItem value="not_interested">Sin interés</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notas</Label>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Agregar notas..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estado</span>
                      {getStatusBadge(selectedLead.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fuente</span>
                      {getSourceBadge(selectedLead.source)}
                    </div>
                    {selectedLead.notes && (
                      <div className="pt-2 border-t border-border mt-2">
                        <span className="text-muted-foreground block mb-1">Notas:</span>
                        <p className="text-foreground">{selectedLead.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Benefit Section */}
              <div className="p-4 rounded-lg bg-[#8B1E2F]/5 border border-[#8B1E2F]/20">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#8B1E2F]" />
                  Beneficio Kipper
                </h4>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="benefit-applied"
                        checked={editBenefitApplied}
                        onChange={(e) => setEditBenefitApplied(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="benefit-applied">Aplicar beneficio</Label>
                    </div>
                    {editBenefitApplied && (
                      <>
                        <div>
                          <Label>Tipo de beneficio</Label>
                          <Select value={editBenefitType} onValueChange={setEditBenefitType}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="discount_percentage">
                                Descuento porcentual
                              </SelectItem>
                              <SelectItem value="extra_washes">Lavados extra</SelectItem>
                              <SelectItem value="vip">Cliente VIP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Valor (ej: 10%, 2 lavados)</Label>
                          <Input
                            value={editBenefitValue}
                            onChange={(e) => setEditBenefitValue(e.target.value)}
                            placeholder="10% o 2 lavados..."
                            className="mt-1"
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : selectedLead.kipper_benefit_applied ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">Beneficio aplicado</span>
                    </div>
                    <p className="text-muted-foreground">
                      Tipo: {selectedLead.benefit_type || "-"}
                    </p>
                    <p className="text-muted-foreground">
                      Valor: {selectedLead.benefit_value || "-"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin beneficio aplicado. Editar para aplicar descuento o beneficio VIP.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#8B1E2F] hover:bg-[#6B1726]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar cambios
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
