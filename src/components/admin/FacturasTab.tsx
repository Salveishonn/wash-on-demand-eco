import { useState, useEffect, useCallback } from "react";
import { 
  FileText, 
  Download, 
  Loader2, 
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  amount_ars: number;
  issued_at: string;
  paid_at: string | null;
  pdf_url: string | null;
  booking_id: string | null;
  subscription_id: string | null;
  metadata: Record<string, unknown>;
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pendiente",
  paid: "Pagado",
  void: "Anulado",
};

const formatPrice = (amount: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export function FacturasTab() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("issued_at", { ascending: false });

      if (error) throw error;
      setInvoices((data as Invoice[]) || []);
    } catch (error: any) {
      console.error("Error fetching invoices:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar las facturas",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchInvoices();
    setIsRefreshing(false);
  };

  const handleUpdateStatus = async (invoiceId: string, newStatus: "paid" | "void") => {
    setIsUpdating(invoiceId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-invoice-status", {
        body: { invoice_id: invoiceId, status: newStatus },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Factura actualizada",
        description: data.message,
      });

      await fetchInvoices();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo actualizar la factura",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (searchQuery) {
      return inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const stats = {
    total: invoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    pending: invoices.filter((i) => i.status === "pending_payment").length,
    void: invoices.filter((i) => i.status === "void").length,
    totalAmount: invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amount_ars, 0),
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "pending_payment":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "void":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-green-100 text-green-800",
      pending_payment: "bg-yellow-100 text-yellow-800",
      void: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {getStatusIcon(status)}
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
          <div className="text-sm text-muted-foreground">Pagadas</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-muted-foreground">Pendientes</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">{stats.void}</div>
          <div className="text-sm text-muted-foreground">Anuladas</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-lg font-bold text-foreground">{formatPrice(stats.totalAmount)}</div>
          <div className="text-sm text-muted-foreground">Cobrado</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de factura..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="paid">Pagadas</SelectItem>
            <SelectItem value="pending_payment">Pendientes</SelectItem>
            <SelectItem value="void">Anuladas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Invoices list */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Número</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fecha</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Estado</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Monto</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Tipo</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No hay facturas
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{invoice.invoice_number}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {formatDate(invoice.issued_at)}
                      {invoice.paid_at && (
                        <div className="text-xs text-green-600">
                          Pagado: {formatDate(invoice.paid_at)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">{getStatusBadge(invoice.status)}</td>
                    <td className="p-4 text-right font-medium">{formatPrice(invoice.amount_ars)}</td>
                    <td className="p-4 text-muted-foreground text-sm">
                      {invoice.booking_id ? "Reserva" : invoice.subscription_id ? "Suscripción" : "-"}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {invoice.pdf_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {invoice.status === "pending_payment" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(invoice.id, "paid")}
                              disabled={isUpdating === invoice.id}
                            >
                              {isUpdating === invoice.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Marcar pagada
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStatus(invoice.id, "void")}
                              disabled={isUpdating === invoice.id}
                              className="text-destructive"
                            >
                              Anular
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
