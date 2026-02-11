import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, RefreshCw, Users, Trash2, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { AdminDateFilter, type DateRange } from "./AdminDateFilter";
import { AdminTestFilter, type TestFilterMode } from "./AdminTestFilter";
import { BulkDeleteDialog } from "./BulkDeleteDialog";

interface Contact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  source: string;
  sources: string[] | null;
  tags: string[] | null;
  is_test: boolean;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_activity_at: string | null;
  created_at: string | null;
}

export const ContactsTab = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [testFilter, setTestFilter] = useState<TestFilterMode>("real");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "filtered" | "test">("selected");

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("last_activity_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Error al cargar contactos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (dateRange) {
        const activity = c.last_activity_at ? new Date(c.last_activity_at) : c.created_at ? new Date(c.created_at) : null;
        if (activity && (activity < dateRange.from || activity > dateRange.to)) return false;
      }
      if (testFilter === "real" && c.is_test) return false;
      if (testFilter === "test" && !c.is_test) return false;
      return true;
    });
  }, [contacts, dateRange, testFilter]);

  const handleExportCSV = () => {
    if (filteredContacts.length === 0) {
      toast.error("No hay contactos para exportar");
      return;
    }

    const headers = ["Email", "Nombre", "Teléfono", "Fuentes", "Tags", "Primera vez", "Última actividad"];
    const rows = filteredContacts.map(c => [
      c.email,
      c.name || "",
      c.phone || "",
      (c.sources || []).join("; "),
      (c.tags || []).join("; "),
      c.first_seen_at ? format(new Date(c.first_seen_at), "dd/MM/yyyy HH:mm") : "",
      c.last_activity_at ? format(new Date(c.last_activity_at), "dd/MM/yyyy HH:mm") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `washero-contactos-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("CSV exportado correctamente");
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      early_access: "Early Access",
      booking: "Reserva",
      subscription: "Suscripción",
      contact: "Contacto",
    };
    return labels[source] || source;
  };

  const getTagColor = (tag: string) => {
    const colors: Record<string, string> = {
      early_access: "bg-amber-100 text-amber-800 border-amber-200",
      booking: "bg-blue-100 text-blue-800 border-blue-200",
      subscription: "bg-green-100 text-green-800 border-green-200",
      contact: "bg-purple-100 text-purple-800 border-purple-200",
    };
    return colors[tag] || "bg-muted text-muted-foreground";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const getDeleteIds = () => {
    switch (bulkDeleteMode) {
      case "selected": return Array.from(selectedIds);
      case "filtered": return filteredContacts.map((c) => c.id);
      case "test": return contacts.filter((c) => c.is_test).map((c) => c.id);
    }
  };

  const handleBulkDelete = async () => {
    const ids = getDeleteIds();
    if (ids.length === 0) return;

    const { error } = await supabase.from("contacts").delete().in("id", ids);
    if (error) {
      toast.error("Error al eliminar registros");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("admin_logs").insert({
        admin_user_id: user.id,
        action: "bulk_delete",
        affected_table: "contacts",
        affected_count: ids.length,
        details: { mode: bulkDeleteMode },
      });
    }

    toast.success(`${ids.length} contacto(s) eliminado(s)`);
    setSelectedIds(new Set());
    fetchContacts();
  };

  const handleToggleTest = async (id: string, isTest: boolean) => {
    const { error } = await supabase.from("contacts").update({ is_test: isTest }).eq("id", id);
    if (error) {
      toast.error("Error al actualizar");
      return;
    }
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, is_test: isTest } : c)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contactos / Emails
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchContacts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredContacts.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <AdminDateFilter onDateRangeChange={setDateRange} />
          <AdminTestFilter value={testFilter} onChange={setTestFilter} />
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => { setBulkDeleteMode("selected"); setBulkDeleteOpen(true); }}>
              <Trash2 className="w-4 h-4 mr-1" /> Eliminar ({selectedIds.size})
            </Button>
          )}
          {filteredContacts.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => { setBulkDeleteMode("filtered"); setBulkDeleteOpen(true); }}>
              <Trash2 className="w-4 h-4 mr-1" /> Eliminar filtrados ({filteredContacts.length})
            </Button>
          )}
          {contacts.some((c) => c.is_test) && (
            <Button variant="outline" size="sm" onClick={() => { setBulkDeleteMode("test"); setBulkDeleteOpen(true); }}>
              <FlaskConical className="w-4 h-4 mr-1" /> Limpiar test ({contacts.filter((c) => c.is_test).length})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay contactos.</div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground px-4 pt-3">
                Total: {filteredContacts.length} contactos
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Fuentes</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Primera vez</TableHead>
                      <TableHead>Última actividad</TableHead>
                      <TableHead className="w-16">Test</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.id} className={contact.is_test ? "opacity-60" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => toggleSelect(contact.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{contact.email}</TableCell>
                        <TableCell className="text-sm">{contact.name || "-"}</TableCell>
                        <TableCell className="text-sm">{contact.phone || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(contact.sources || []).map((src, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {getSourceLabel(src)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(contact.tags || []).map((tag, idx) => (
                              <Badge key={idx} variant="outline" className={`text-xs ${getTagColor(tag)}`}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {contact.first_seen_at
                            ? format(new Date(contact.first_seen_at), "dd MMM yyyy", { locale: es })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {contact.last_activity_at
                            ? format(new Date(contact.last_activity_at), "dd MMM yyyy, HH:mm", { locale: es })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={contact.is_test}
                            onCheckedChange={(checked) => handleToggleTest(contact.id, !!checked)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={getDeleteIds().length}
        description={
          bulkDeleteMode === "test"
            ? "Se eliminarán todos los contactos marcados como TEST."
            : bulkDeleteMode === "filtered"
            ? "Se eliminarán todos los contactos filtrados."
            : "Se eliminarán los contactos seleccionados."
        }
        onConfirm={handleBulkDelete}
      />
    </div>
  );
};
