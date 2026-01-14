import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Contact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  source: string;
  tags: string[];
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
}

export const ContactsTab = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("last_seen_at", { ascending: false });

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

  const handleExportCSV = () => {
    if (contacts.length === 0) {
      toast.error("No hay contactos para exportar");
      return;
    }

    const headers = ["Email", "Nombre", "Teléfono", "Fuente", "Tags", "Primera vez", "Última vez"];
    const rows = contacts.map(c => [
      c.email,
      c.name || "",
      c.phone || "",
      c.source,
      (c.tags || []).join("; "),
      format(new Date(c.first_seen_at), "dd/MM/yyyy HH:mm"),
      format(new Date(c.last_seen_at), "dd/MM/yyyy HH:mm"),
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Contactos / Emails
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchContacts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={contacts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay contactos registrados aún.
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Total: {contacts.length} contactos
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Última actividad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.email}</TableCell>
                      <TableCell>{contact.name || "-"}</TableCell>
                      <TableCell>{contact.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getSourceLabel(contact.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(contact.tags || []).map((tag, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className={`text-xs ${getTagColor(tag)}`}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(contact.last_seen_at), "dd MMM yyyy, HH:mm", { locale: es })}
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
  );
};
