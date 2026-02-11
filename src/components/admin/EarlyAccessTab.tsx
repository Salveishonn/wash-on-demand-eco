import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Users, Trash2, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { AdminDateFilter, type DateRange } from "./AdminDateFilter";
import { AdminTestFilter, type TestFilterMode } from "./AdminTestFilter";
import { BulkDeleteDialog } from "./BulkDeleteDialog";

interface EarlyAccessLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_test: boolean;
  created_at: string;
}

export const EarlyAccessTab = () => {
  const [leads, setLeads] = useState<EarlyAccessLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [testFilter, setTestFilter] = useState<TestFilterMode>("real");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "filtered" | "test">("selected");

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("early_access_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching early access leads:", error);
      toast.error("Error al cargar leads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Date filter
      if (dateRange) {
        const created = new Date(lead.created_at);
        if (created < dateRange.from || created > dateRange.to) return false;
      }
      // Test filter
      if (testFilter === "real" && lead.is_test) return false;
      if (testFilter === "test" && !lead.is_test) return false;
      return true;
    });
  }, [leads, dateRange, testFilter]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: es });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const getDeleteIds = () => {
    switch (bulkDeleteMode) {
      case "selected":
        return Array.from(selectedIds);
      case "filtered":
        return filteredLeads.map((l) => l.id);
      case "test":
        return leads.filter((l) => l.is_test).map((l) => l.id);
    }
  };

  const handleBulkDelete = async () => {
    const ids = getDeleteIds();
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("early_access_leads")
      .delete()
      .in("id", ids);

    if (error) {
      toast.error("Error al eliminar registros");
      return;
    }

    // Log action
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("admin_logs").insert({
        admin_user_id: user.id,
        action: "bulk_delete",
        affected_table: "early_access_leads",
        affected_count: ids.length,
        details: { mode: bulkDeleteMode },
      });
    }

    toast.success(`${ids.length} registro(s) eliminado(s)`);
    setSelectedIds(new Set());
    fetchLeads();
  };

  const handleToggleTest = async (id: string, isTest: boolean) => {
    const { error } = await supabase
      .from("early_access_leads")
      .update({ is_test: isTest })
      .eq("id", id);

    if (error) {
      toast.error("Error al actualizar");
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, is_test: isTest } : l)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Early Access</h2>
            <p className="text-muted-foreground text-sm">
              Leads de acceso anticipado con 20% de descuento
            </p>
          </div>
          <Button variant="outline" onClick={fetchLeads} disabled={isLoading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <AdminDateFilter onDateRangeChange={setDateRange} />
          <AdminTestFilter value={testFilter} onChange={setTestFilter} />
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setBulkDeleteMode("selected");
                setBulkDeleteOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Eliminar ({selectedIds.size})
            </Button>
          )}
          {filteredLeads.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkDeleteMode("filtered");
                setBulkDeleteOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Eliminar filtrados ({filteredLeads.length})
            </Button>
          )}
          {leads.some((l) => l.is_test) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkDeleteMode("test");
                setBulkDeleteOpen(true);
              }}
            >
              <FlaskConical className="w-4 h-4 mr-1" />
              Limpiar test ({leads.filter((l) => l.is_test).length})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Leads registrados
          </CardTitle>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {filteredLeads.length}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay leads registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-16">Test</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className={lead.is_test ? "opacity-60" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>
                        <a href={`mailto:${lead.email}`} className="text-primary hover:underline text-sm">
                          {lead.email}
                        </a>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          {lead.phone}
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(lead.created_at)}
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={lead.is_test}
                          onCheckedChange={(checked) => handleToggleTest(lead.id, !!checked)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={getDeleteIds().length}
        description={
          bulkDeleteMode === "test"
            ? "Se eliminarán todos los registros marcados como TEST."
            : bulkDeleteMode === "filtered"
            ? "Se eliminarán todos los registros que coinciden con los filtros actuales."
            : "Se eliminarán los registros seleccionados."
        }
        onConfirm={handleBulkDelete}
      />
    </div>
  );
};
