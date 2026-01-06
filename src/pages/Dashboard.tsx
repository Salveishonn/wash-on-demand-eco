import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AddressAutocomplete, PlaceSelection } from "@/components/booking/AddressAutocomplete";
import { SubscriptionCalendarScheduler } from "@/components/booking/SubscriptionCalendarScheduler";
import {
  Loader2,
  Calendar,
  Car,
  MapPin,
  CreditCard,
  Pause,
  Play,
  Plus,
  Edit,
  Trash2,
  Clock,
  LogOut,
  History,
  FileText,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Download,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Subscription {
  id: string;
  plan_id: string;
  plan_code: string | null;
  status: string;
  washes_remaining: number;
  washes_used_in_cycle: number;
  current_period_start: string | null;
  current_period_end: string | null;
  included_service: string | null;
  included_vehicle_size: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  subscription_plans?: {
    name: string;
    washes_per_month: number;
    price_cents: number;
  };
}

interface UserCar {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  plate: string | null;
  color: string | null;
  is_default: boolean | null;
}

interface UserAddress {
  id: string;
  label: string | null;
  line1: string;
  neighborhood: string | null;
  city: string | null;
  is_default: boolean | null;
}

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  service_name: string;
  status: string;
  address: string | null;
  total_cents: number | null;
  is_subscription_booking: boolean | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  amount_ars: number;
  issued_at: string;
  paid_at: string | null;
  pdf_url: string | null;
}

interface Profile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

const PLAN_INFO: Record<string, { name: string; washes: number; price: string; serviceIncluded: string }> = {
  basic: { name: "Plan Básico", washes: 2, price: "$55.000", serviceIncluded: "Lavado Exterior + Interior" },
  confort: { name: "Plan Confort", washes: 4, price: "$95.000", serviceIncluded: "Lavado Exterior + Interior" },
  premium: { name: "Plan Premium", washes: 4, price: "$125.000", serviceIncluded: "Detailing Completo" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [cars, setCars] = useState<UserCar[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Modal states
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSubscriptionSchedulerOpen, setIsSubscriptionSchedulerOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<UserCar | null>(null);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [carForm, setCarForm] = useState({
    nickname: "",
    brand: "",
    model: "",
    plate: "",
    color: "",
  });
  const [addressForm, setAddressForm] = useState({
    label: "Casa",
    line1: "",
    neighborhood: "",
    city: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=/dashboard");
      return;
    }
    setUser(session.user);
    await fetchUserData(session.user.id);
  };

  const fetchUserData = async (userId: string) => {
    setIsLoading(true);
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", userId)
        .single();
      setProfile(profileData);

      // Fetch subscription from canonical `subscriptions` table
      const { data: subData } = await supabase
        .from("subscriptions")
        .select(`
          *,
          subscription_plans (
            name,
            washes_per_month,
            price_cents
          )
        `)
        .eq("user_id", userId)
        .in("status", ["active", "paused", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setSubscription(subData);

      // Fetch cars
      const { data: carsData } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setCars(carsData || []);

      // Fetch addresses
      const { data: addressesData } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setAddresses(addressesData || []);

      // Fetch upcoming bookings
      const today = new Date().toISOString().split("T")[0];
      const { data: upcomingData } = await supabase
        .from("bookings")
        .select("id, booking_date, booking_time, service_name, status, address, total_cents, is_subscription_booking")
        .eq("user_id", userId)
        .gte("booking_date", today)
        .neq("status", "cancelled")
        .order("booking_date", { ascending: true })
        .limit(10);
      setUpcomingBookings(upcomingData || []);

      // Fetch past bookings
      const { data: pastData } = await supabase
        .from("bookings")
        .select("id, booking_date, booking_time, service_name, status, address, total_cents, is_subscription_booking")
        .eq("user_id", userId)
        .lt("booking_date", today)
        .order("booking_date", { ascending: false })
        .limit(20);
      setPastBookings(pastData || []);

      // Fetch invoices
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, amount_ars, issued_at, paid_at, pdf_url")
        .eq("user_id", userId)
        .order("issued_at", { ascending: false })
        .limit(50);
      setInvoices((invoicesData as Invoice[]) || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const toggleSubscriptionPause = async () => {
    if (!subscription) return;

    const newStatus = subscription.status === "paused" ? "active" : "paused";

    try {
      // Use edge function to update status properly
      const { data, error } = await supabase.functions.invoke("admin-set-subscription-status", {
        body: {
          subscription_id: subscription.id,
          status: newStatus,
        },
      });
      if (error || !data?.success) throw error || new Error(data?.error);

      if (error) throw error;

      setSubscription({ ...subscription, status: newStatus });
      toast({
        title: newStatus === "paused" ? "Suscripción pausada" : "Suscripción reactivada",
        description: newStatus === "paused"
          ? "No se programarán nuevos lavados hasta que la reactives."
          : "Podés volver a agendar tus lavados.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la suscripción.",
      });
    }
  };

  // Car CRUD
  const openCarModal = (car?: UserCar) => {
    if (car) {
      setEditingCar(car);
      setCarForm({
        nickname: car.nickname || "",
        brand: car.brand || "",
        model: car.model || "",
        plate: car.plate || "",
        color: car.color || "",
      });
    } else {
      setEditingCar(null);
      setCarForm({ nickname: "", brand: "", model: "", plate: "", color: "" });
    }
    setIsCarModalOpen(true);
  };

  const handleSaveCar = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (editingCar) {
        const { error } = await supabase
          .from("cars")
          .update(carForm)
          .eq("id", editingCar.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cars")
          .insert({ ...carForm, user_id: user.id });
        if (error) throw error;
      }

      toast({ title: editingCar ? "Auto actualizado" : "Auto agregado" });
      setIsCarModalOpen(false);
      fetchUserData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo guardar el auto.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCar = async (carId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("cars").delete().eq("id", carId);
      if (error) throw error;
      toast({ title: "Auto eliminado" });
      fetchUserData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el auto.",
      });
    }
  };

  // Address CRUD with Google Places
  const openAddressModal = (address?: UserAddress) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label || "Casa",
        line1: address.line1,
        neighborhood: address.neighborhood || "",
        city: address.city || "",
      });
    } else {
      setEditingAddress(null);
      setAddressForm({ label: "Casa", line1: "", neighborhood: "", city: "" });
    }
    setIsAddressModalOpen(true);
  };

  const handleAddressSelect = (selection: PlaceSelection) => {
    setAddressForm(prev => ({
      ...prev,
      line1: selection.address,
    }));
  };

  const handleSaveAddress = async () => {
    if (!user || !addressForm.line1) return;
    setIsSubmitting(true);

    try {
      if (editingAddress) {
        const { error } = await supabase
          .from("addresses")
          .update(addressForm)
          .eq("id", editingAddress.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("addresses")
          .insert({ ...addressForm, user_id: user.id });
        if (error) throw error;
      }

      toast({ title: editingAddress ? "Dirección actualizada" : "Dirección agregada" });
      setIsAddressModalOpen(false);
      fetchUserData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo guardar la dirección.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("addresses").delete().eq("id", addressId);
      if (error) throw error;
      toast({ title: "Dirección eliminada" });
      fetchUserData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar la dirección.",
      });
    }
  };

  // Get user display name
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name.split(" ")[0];
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name.split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "Usuario";
  };

  // Use plan_code for lookup, or fall back to subscription_plans data
  const planCode = subscription?.plan_code || "";
  const planInfo = subscription ? (PLAN_INFO[planCode] || {
    name: subscription.subscription_plans?.name || "Plan",
    washes: subscription.subscription_plans?.washes_per_month || 0,
    price: subscription.subscription_plans?.price_cents 
      ? `$${Math.round(subscription.subscription_plans.price_cents / 100).toLocaleString("es-AR")}`
      : "N/A",
    serviceIncluded: subscription.included_service === "complete" ? "Lavado Completo" : "Lavado Básico",
  }) : null;
  const washesRemaining = subscription?.washes_remaining ?? planInfo?.washes ?? 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header with personalized greeting */}
      <section className="py-8 md:py-12 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-2xl md:text-3xl font-black text-background">
                Hola, <span className="text-primary">{getDisplayName()}</span>
              </h1>
              <p className="text-background/70 text-sm mt-1">{user?.email}</p>
            </motion.div>
            <Button variant="heroDark" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </section>

      <section className="py-8 md:py-12 bg-background">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
              <TabsTrigger value="overview" className="text-xs md:text-sm">
                <CreditCard className="w-4 h-4 mr-1 hidden md:inline" />
                Mi Plan
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs md:text-sm">
                <Calendar className="w-4 h-4 mr-1 hidden md:inline" />
                Próximos
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs md:text-sm">
                <History className="w-4 h-4 mr-1 hidden md:inline" />
                Historial
              </TabsTrigger>
              <TabsTrigger value="cars" className="text-xs md:text-sm">
                <Car className="w-4 h-4 mr-1 hidden md:inline" />
                Autos
              </TabsTrigger>
              <TabsTrigger value="addresses" className="text-xs md:text-sm">
                <MapPin className="w-4 h-4 mr-1 hidden md:inline" />
                Direcciones
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs md:text-sm">
                <FileText className="w-4 h-4 mr-1 hidden md:inline" />
                Facturas
              </TabsTrigger>
            </TabsList>

            {/* Overview / Subscription Tab */}
            <TabsContent value="overview" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Mi Suscripción
                  </h2>
                  {subscription && subscription.status !== "pending" && (
                    <Button variant="outline" size="sm" onClick={toggleSubscriptionPause}>
                      {subscription.status === "paused" ? (
                        <>
                          <Play className="w-4 h-4 mr-1" />
                          Reanudar
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {subscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl">
                      <div>
                        <p className="font-display text-lg font-bold text-foreground">
                          {planInfo?.name || subscription.plan_id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {planInfo?.washes} lavados/mes • {planInfo?.price}/mes
                        </p>
                        {planInfo && (
                          <p className="text-xs text-primary mt-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Incluye: {planInfo.serviceIncluded}
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          subscription.status === "active"
                            ? "bg-washero-eco/20 text-washero-eco"
                            : subscription.status === "paused"
                            ? "bg-orange-100 text-orange-800"
                            : subscription.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : subscription.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {subscription.status === "active"
                          ? "Activo"
                          : subscription.status === "paused"
                          ? "Pausado"
                          : subscription.status === "pending"
                          ? "Pendiente de aprobación"
                          : subscription.status === "cancelled"
                          ? "Cancelado"
                          : subscription.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-primary">{washesRemaining}</p>
                        <p className="text-sm text-muted-foreground">Lavados restantes</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {subscription.washes_used_in_cycle || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Usados este mes</p>
                      </div>
                    </div>

                    {subscription.status === "active" && washesRemaining > 0 && (
                      <Button className="w-full" onClick={() => setIsSubscriptionSchedulerOpen(true)}>
                        <Calendar className="w-4 h-4 mr-2" />
                        Agendar un lavado de mi plan
                      </Button>
                    )}

                    {subscription.status === "pending" && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <div className="flex items-center gap-2 text-yellow-800">
                          <AlertCircle className="w-4 h-4" />
                          <p className="text-sm font-medium">
                            Tu suscripción está pendiente de activación.
                          </p>
                        </div>
                        <p className="text-xs text-yellow-700 mt-1">
                          Te contactaremos para coordinar el pago.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No tenés una suscripción activa</p>
                    <Button onClick={() => navigate("/suscripciones")}>Ver planes</Button>
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* Upcoming Bookings Tab */}
            <TabsContent value="upcoming" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Próximos Lavados
                  </h2>
                  <Button variant="outline" size="sm" onClick={() => navigate("/reservar")}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agendar
                  </Button>
                </div>

                {upcomingBookings.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{booking.service_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(`${booking.booking_date}T${booking.booking_time}`), "EEEE d MMM, HH:mm", { locale: es })}
                            </p>
                            {booking.address && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {booking.address}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              booking.status === "confirmed"
                                ? "bg-washero-eco/20 text-washero-eco"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {booking.status === "confirmed" ? "Confirmado" : "Pendiente"}
                          </span>
                          {booking.is_subscription_booking && (
                            <p className="text-xs text-primary mt-1 flex items-center justify-end gap-1">
                              <Sparkles className="w-3 h-3" />
                              De mi plan
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No tenés lavados programados</p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/reservar")}>
                      Agendar un lavado
                    </Button>
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-primary" />
                  Historial de Lavados
                </h2>

                {pastBookings.length > 0 ? (
                  <div className="space-y-3">
                    {pastBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{booking.service_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(`${booking.booking_date}T${booking.booking_time}`), "d MMM yyyy, HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {booking.total_cents && !booking.is_subscription_booking && (
                            <p className="font-medium text-foreground">
                              ${(booking.total_cents / 100).toLocaleString("es-AR")}
                            </p>
                          )}
                          {booking.is_subscription_booking && (
                            <p className="text-xs text-primary flex items-center justify-end gap-1">
                              <Sparkles className="w-3 h-3" />
                              Plan
                            </p>
                          )}
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              booking.status === "completed"
                                ? "bg-washero-eco/20 text-washero-eco"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {booking.status === "completed" ? "Completado" : booking.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No tenés lavados anteriores</p>
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* Cars Tab */}
            <TabsContent value="cars" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <Car className="w-5 h-5 text-primary" />
                    Mis Autos
                  </h2>
                  <Button variant="outline" size="sm" onClick={() => openCarModal()}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>

                {cars.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {cars.map((car) => (
                      <div key={car.id} className="p-4 bg-muted/30 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">
                              {car.nickname || `${car.brand || ""} ${car.model || ""}`.trim() || "Mi auto"}
                            </p>
                            {car.plate && <p className="text-sm text-muted-foreground">{car.plate}</p>}
                            {car.color && <p className="text-xs text-muted-foreground">{car.color}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCarModal(car)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteCar(car.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => openCarModal()}
                    className="w-full py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="w-6 h-6 mx-auto mb-2" />
                    <span>Agregar mi primer auto</span>
                  </button>
                )}
              </motion.div>
            </TabsContent>

            {/* Addresses Tab */}
            <TabsContent value="addresses" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Mis Direcciones
                  </h2>
                  <Button variant="outline" size="sm" onClick={() => openAddressModal()}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>

                {addresses.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {addresses.map((address) => (
                      <div key={address.id} className="p-4 bg-muted/30 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{address.label}</p>
                            <p className="text-sm text-muted-foreground truncate">{address.line1}</p>
                            {address.neighborhood && (
                              <p className="text-xs text-muted-foreground">{address.neighborhood}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAddressModal(address)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteAddress(address.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => openAddressModal()}
                    className="w-full py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="w-6 h-6 mx-auto mb-2" />
                    <span>Agregar mi primera dirección</span>
                  </button>
                )}
              </motion.div>
            </TabsContent>

            {/* Invoices Tab */}
            <TabsContent value="invoices" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-primary" />
                  Facturas
                </h2>

                {invoices.length > 0 ? (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{invoice.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(invoice.issued_at), "d MMM yyyy", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium text-foreground">
                              ${invoice.amount_ars.toLocaleString("es-AR")}
                            </p>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              invoice.status === "paid" 
                                ? "bg-green-100 text-green-800" 
                                : invoice.status === "void"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {invoice.status === "paid" ? "Pagado" : invoice.status === "void" ? "Anulado" : "Pendiente"}
                            </span>
                          </div>
                          {invoice.pdf_url && (
                            <a 
                              href={invoice.pdf_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                            >
                              <Download className="w-4 h-4 text-primary" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No tenés facturas disponibles</p>
                    <p className="text-xs mt-1">Las facturas aparecerán después de completar servicios pagos</p>
                  </div>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Car Modal */}
      <Dialog open={isCarModalOpen} onOpenChange={setIsCarModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCar ? "Editar auto" : "Agregar auto"}</DialogTitle>
            <DialogDescription>Agregá los datos de tu vehículo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Apodo (opcional)</Label>
                <Input
                  placeholder="Mi auto"
                  value={carForm.nickname}
                  onChange={(e) => setCarForm({ ...carForm, nickname: e.target.value })}
                />
              </div>
              <div>
                <Label>Patente</Label>
                <Input
                  placeholder="ABC 123"
                  value={carForm.plate}
                  onChange={(e) => setCarForm({ ...carForm, plate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marca</Label>
                <Input
                  placeholder="Toyota"
                  value={carForm.brand}
                  onChange={(e) => setCarForm({ ...carForm, brand: e.target.value })}
                />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input
                  placeholder="Corolla"
                  value={carForm.model}
                  onChange={(e) => setCarForm({ ...carForm, model: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <Input
                placeholder="Blanco"
                value={carForm.color}
                onChange={(e) => setCarForm({ ...carForm, color: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsCarModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSaveCar} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Modal with Google Places */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAddress ? "Editar dirección" : "Agregar dirección"}</DialogTitle>
            <DialogDescription>Agregá una dirección para tus lavados</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Etiqueta</Label>
              <Input
                placeholder="Casa, Oficina, etc."
                value={addressForm.label}
                onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <AddressAutocomplete
                key={isAddressModalOpen ? "open" : "closed"}
                initialValue={addressForm.line1}
                placeholder="Av. Libertador 1234, Buenos Aires"
                onTextChange={(text) => setAddressForm({ ...addressForm, line1: text })}
                onSelect={handleAddressSelect}
              />
            </div>
            <div>
              <Label>Barrio (opcional)</Label>
              <Input
                placeholder="Palermo"
                value={addressForm.neighborhood}
                onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddressModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSaveAddress} disabled={isSubmitting || !addressForm.line1}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Scheduler Modal */}
      <AnimatePresence>
        {isSubscriptionSchedulerOpen && subscription && user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setIsSubscriptionSchedulerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl shadow-xl border border-border"
            >
              {/* Header */}
              <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Agendar lavado de mi plan
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Seleccioná una fecha y horario
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsSubscriptionSchedulerOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Subscription Info */}
              <div className="p-4 border-b border-border bg-primary/5">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-foreground">{planInfo?.name}</span>
                  <span className="text-sm text-primary font-medium">
                    {washesRemaining} lavado{washesRemaining !== 1 ? "s" : ""} restante{washesRemaining !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Incluye: {planInfo?.serviceIncluded}</span>
                </div>
              </div>

              {/* Calendar */}
              <div className="p-4">
                <SubscriptionCalendarScheduler
                  subscription={{
                    id: subscription.id,
                    plan_id: subscription.plan_code || subscription.plan_id,
                    status: subscription.status,
                    washes_remaining: subscription.washes_remaining,
                    washes_used_this_month: subscription.washes_used_in_cycle,
                  }}
                  cars={cars}
                  addresses={addresses}
                  userId={user.id}
                  onBookingComplete={() => {
                    setIsSubscriptionSchedulerOpen(false);
                    fetchUserData(user.id);
                    toast({
                      title: "¡Lavado agendado!",
                      description: "Tu lavado fue programado correctamente.",
                    });
                  }}
                  onNeedsCar={() => {
                    setIsSubscriptionSchedulerOpen(false);
                    openCarModal();
                  }}
                  onNeedsAddress={() => {
                    setIsSubscriptionSchedulerOpen(false);
                    openAddressModal();
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
