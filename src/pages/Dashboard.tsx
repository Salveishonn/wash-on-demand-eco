import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ChevronRight,
  ArrowRight,
  MessageCircle,
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

const PLAN_INFO: Record<string, { name: string; washes: number; price: string; serviceIncluded: string; shared?: boolean; maxVehicles?: number }> = {
  esencial: { name: "Plan Esencial", washes: 2, price: "$55.000", serviceIncluded: "Lavado Básico" },
  basic: { name: "Plan Esencial", washes: 2, price: "$55.000", serviceIncluded: "Lavado Básico" },
  confort: { name: "Plan Confort", washes: 4, price: "$95.000", serviceIncluded: "Lavado Básico" },
  pro: { name: "Plan Pro", washes: 4, price: "$125.000", serviceIncluded: "Lavado Completo" },
  premium: { name: "Plan Pro", washes: 4, price: "$125.000", serviceIncluded: "Lavado Completo" },
  familia: { name: "Plan Familia", washes: 6, price: "$145.000", serviceIncluded: "Lavado Básico", shared: true, maxVehicles: 3 },
  flota: { name: "Plan Flota", washes: 10, price: "$250.000", serviceIncluded: "Lavado Básico", shared: true, maxVehicles: 10 },
};

/* ─────────── Expandable section helper ─────────── */
function Section({ title, icon: Icon, children, defaultOpen = true, action }: {
  title: string;
  icon: any;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 md:p-5 text-left"
      >
        <span className="font-display text-base md:text-lg font-bold flex items-center gap-2 text-foreground">
          <Icon className="w-5 h-5 text-primary" />
          {title}
        </span>
        <span className="flex items-center gap-2">
          {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 md:px-5 md:pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

  // Modal states
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSubscriptionSchedulerOpen, setIsSubscriptionSchedulerOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<UserCar | null>(null);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [carForm, setCarForm] = useState({ nickname: "", brand: "", model: "", plate: "", color: "" });
  const [addressForm, setAddressForm] = useState({ label: "Casa", line1: "", neighborhood: "", city: "" });

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth?redirect=/dashboard"); return; }
    setUser(session.user);
    await fetchUserData(session.user.id);
  };

  const fetchUserData = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data: profileData } = await supabase.from("profiles").select("full_name, email, phone").eq("user_id", userId).single();
      setProfile(profileData);

      const { data: subData } = await supabase
        .from("subscriptions")
        .select(`*, subscription_plans (name, washes_per_month, price_cents)`)
        .eq("user_id", userId)
        .in("status", ["active", "paused", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setSubscription(subData);

      const { data: carsData } = await supabase.from("cars").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      setCars(carsData || []);

      const { data: addressesData } = await supabase.from("addresses").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      setAddresses(addressesData || []);

      const today = new Date().toISOString().split("T")[0];
      const { data: upcomingData } = await supabase.from("bookings").select("id, booking_date, booking_time, service_name, status, address, total_cents, is_subscription_booking").eq("user_id", userId).gte("booking_date", today).neq("status", "cancelled").order("booking_date", { ascending: true }).limit(10);
      setUpcomingBookings(upcomingData || []);

      const { data: pastData } = await supabase.from("bookings").select("id, booking_date, booking_time, service_name, status, address, total_cents, is_subscription_booking").eq("user_id", userId).lt("booking_date", today).order("booking_date", { ascending: false }).limit(20);
      setPastBookings(pastData || []);

      const { data: invoicesData } = await supabase.from("invoices").select("id, invoice_number, status, amount_ars, issued_at, paid_at, pdf_url").eq("user_id", userId).order("issued_at", { ascending: false }).limit(50);
      setInvoices((invoicesData as Invoice[]) || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };

  const toggleSubscriptionPause = async () => {
    if (!subscription) return;
    const newStatus = subscription.status === "paused" ? "active" : "paused";
    try {
      const { data, error } = await supabase.functions.invoke("admin-set-subscription-status", {
        body: { subscription_id: subscription.id, status: newStatus },
      });
      if (error || !data?.success) throw error || new Error(data?.error);
      setSubscription({ ...subscription, status: newStatus });
      toast({
        title: newStatus === "paused" ? "Plan pausado" : "Plan reactivado",
        description: newStatus === "paused" ? "No se agendarán nuevos lavados hasta que lo reactives." : "Ya podés volver a agendar tus lavados.",
      });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la suscripción." });
    }
  };

  // Car CRUD
  const openCarModal = (car?: UserCar) => {
    if (car) {
      setEditingCar(car);
      setCarForm({ nickname: car.nickname || "", brand: car.brand || "", model: car.model || "", plate: car.plate || "", color: car.color || "" });
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
        const { error } = await supabase.from("cars").update(carForm).eq("id", editingCar.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cars").insert({ ...carForm, user_id: user.id });
        if (error) throw error;
      }
      toast({ title: editingCar ? "Auto actualizado" : "Auto agregado" });
      setIsCarModalOpen(false);
      fetchUserData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo guardar el auto." });
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
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el auto." });
    }
  };

  // Address CRUD
  const openAddressModal = (address?: UserAddress) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({ label: address.label || "Casa", line1: address.line1, neighborhood: address.neighborhood || "", city: address.city || "" });
    } else {
      setEditingAddress(null);
      setAddressForm({ label: "Casa", line1: "", neighborhood: "", city: "" });
    }
    setIsAddressModalOpen(true);
  };

  const handleAddressSelect = (selection: PlaceSelection) => {
    setAddressForm(prev => ({ ...prev, line1: selection.address }));
  };

  const handleSaveAddress = async () => {
    if (!user || !addressForm.line1) return;
    setIsSubmitting(true);
    try {
      if (editingAddress) {
        const { error } = await supabase.from("addresses").update(addressForm).eq("id", editingAddress.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("addresses").insert({ ...addressForm, user_id: user.id });
        if (error) throw error;
      }
      toast({ title: editingAddress ? "Dirección actualizada" : "Dirección agregada" });
      setIsAddressModalOpen(false);
      fetchUserData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo guardar la dirección." });
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
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la dirección." });
    }
  };

  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name.split(" ")[0];
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name.split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "Usuario";
  };

  const planCode = subscription?.plan_code || "";
  const planInfo = subscription ? (PLAN_INFO[planCode] || {
    name: subscription.subscription_plans?.name || "Plan",
    washes: subscription.subscription_plans?.washes_per_month || 0,
    price: subscription.subscription_plans?.price_cents
      ? `$${Math.round(subscription.subscription_plans.price_cents / 100).toLocaleString("es-AR")}`
      : "N/A",
    serviceIncluded: subscription.included_service === "complete" ? "Detailing Completo" : "Lavado Exterior + Interior",
  }) : null;
  const washesRemaining = subscription?.washes_remaining ?? planInfo?.washes ?? 0;
  const totalWashes = planInfo?.washes ?? 0;

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
      {/* Compact header */}
      <section className="py-5 md:py-8 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-xl md:text-2xl font-black text-background truncate">
                Hola, <span className="text-primary">{getDisplayName()}</span>
              </h1>
              <p className="text-background/60 text-xs md:text-sm truncate">{user?.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-background/70 hover:text-background shrink-0">
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline ml-1.5">Salir</span>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-5 md:py-8 bg-background">
        <div className="container mx-auto px-4 space-y-4 max-w-2xl">

          {/* ═══ SUBSCRIPTION CARD ═══ */}
          {subscription ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {/* A) Top row — status badge + plan name */}
              <div className={`px-5 py-3 flex items-center justify-between ${
                subscription.status === "active" ? "bg-washero-eco/10" :
                subscription.status === "paused" ? "bg-orange-50" :
                subscription.status === "pending" ? "bg-yellow-50" :
                "bg-muted"
              }`}>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase ${
                  subscription.status === "active" ? "text-washero-eco" :
                  subscription.status === "paused" ? "text-orange-700" :
                  subscription.status === "pending" ? "text-yellow-700" :
                  "text-muted-foreground"
                }`}>
                  {subscription.status === "active" ? <CheckCircle className="w-3.5 h-3.5" /> :
                   subscription.status === "paused" ? <Pause className="w-3.5 h-3.5" /> :
                   <Clock className="w-3.5 h-3.5" />}
                  {subscription.status === "active" ? "Activo" :
                   subscription.status === "paused" ? "Pausado" :
                   subscription.status === "pending" ? "Pendiente" :
                   subscription.status}
                </span>
                <span className="font-display text-sm font-bold text-foreground">{planInfo?.name}</span>
              </div>

              <div className="p-5 space-y-5">
                {/* B) Main metrics row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center py-4 px-2 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="text-3xl font-black text-primary leading-none">{washesRemaining}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">Restantes</p>
                  </div>
                  <div className="text-center py-4 px-2 bg-muted/40 rounded-xl">
                    <p className="text-3xl font-black text-foreground leading-none">{subscription.washes_used_in_cycle || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">Usados</p>
                  </div>
                  <div className="text-center py-4 px-2 bg-muted/40 rounded-xl">
                    <p className="text-3xl font-black text-foreground leading-none">{totalWashes}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">Total/mes</p>
                  </div>
                </div>

                {/* C) Included service + price + shared info */}
                <div className="space-y-2">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between bg-muted/30 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground font-medium">{planInfo?.serviceIncluded}</span>
                    </div>
                    <span className="font-display text-base font-bold text-foreground sm:text-right pl-6 sm:pl-0">{planInfo?.price}<span className="text-xs font-normal text-muted-foreground">/mes</span></span>
                  </div>
                  {planInfo?.shared && (
                    <div className="flex items-center gap-2 bg-primary/5 rounded-xl px-4 py-2.5 border border-primary/10">
                      <Car className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">
                        Hasta {planInfo.maxVehicles} vehículos · lavados compartidos
                      </span>
                    </div>
                  )}
                </div>

                {/* D) Main action area — primary CTA full-width */}
                <div className="space-y-2.5">
                  {subscription.status === "active" && washesRemaining > 0 && (
                    <Button className="w-full" size="xl" onClick={() => setIsSubscriptionSchedulerOpen(true)}>
                      <Calendar className="w-5 h-5 mr-2" />
                      Agendar lavado
                    </Button>
                  )}
                  {subscription.status === "active" && washesRemaining === 0 && (
                    <div className="text-center py-3 px-4 bg-muted/50 rounded-xl">
                      <p className="text-sm text-muted-foreground font-medium">No te quedan lavados este mes</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Se renuevan al inicio del próximo ciclo</p>
                    </div>
                  )}
                  {/* Secondary actions row */}
                  {subscription.status !== "pending" && (
                    <Button
                      variant="ghost"
                      size="default"
                      onClick={toggleSubscriptionPause}
                      className="w-full text-muted-foreground hover:text-foreground"
                    >
                      {subscription.status === "paused" ? (
                        <><Play className="w-4 h-4 mr-1.5" /> Reanudar plan</>
                      ) : (
                        <><Pause className="w-4 h-4 mr-1.5" /> Pausar plan</>
                      )}
                    </Button>
                  )}
                </div>

                {subscription.status === "pending" && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <div className="flex items-start gap-2.5 text-yellow-800">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Tu suscripción está pendiente de activación</p>
                        <p className="text-xs mt-1 text-yellow-700 leading-relaxed">Te contactaremos para coordinar el pago y activar tu plan.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* No subscription CTA */
            <div className="bg-card border-2 border-dashed border-primary/30 rounded-2xl p-6 text-center">
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
              <h2 className="font-display text-lg font-bold text-foreground mb-1">¿Querés lavar más seguido?</h2>
              <p className="text-sm text-muted-foreground mb-4">Suscribite a un plan mensual y ahorrá hasta un 35%.</p>
              <Button onClick={() => navigate("/suscripciones")} size="lg">
                Ver planes <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          )}

          {/* ═══ UPCOMING BOOKINGS ═══ */}
          <Section
            title={`Próximos lavados${upcomingBookings.length > 0 ? ` (${upcomingBookings.length})` : ""}`}
            icon={Calendar}
            action={
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/reservar")}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Agendar
              </Button>
            }
          >
            {upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {upcomingBookings.map((b) => (
                  <div key={b.id} className="p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold text-sm text-foreground">{b.service_name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {format(new Date(`${b.booking_date}T${b.booking_time}`), "EEEE d 'de' MMMM, HH:mm'hs'", { locale: es })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          b.status === "confirmed" ? "bg-washero-eco/15 text-washero-eco" : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {b.status === "confirmed" ? "Confirmado" : "Pendiente"}
                        </span>
                        {b.is_subscription_booking && (
                          <span className="text-xs text-primary flex items-center gap-0.5 font-medium">
                            <Sparkles className="w-3 h-3" /> Plan
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/15" />
                <p className="text-sm font-medium text-foreground">No tenés lavados programados</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Agendá tu próximo lavado ahora</p>
                <Button variant="outline" size="default" onClick={() => navigate("/reservar")}>
                  <Plus className="w-4 h-4 mr-1.5" /> Agendar un lavado
                </Button>
              </div>
            )}
          </Section>

          {/* ═══ CARS ═══ */}
          <Section
            title={`Mis autos${cars.length > 0 ? ` (${cars.length})` : ""}`}
            icon={Car}
            defaultOpen={false}
            action={
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openCarModal()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
              </Button>
            }
          >
            {cars.length > 0 ? (
              <div className="space-y-2">
                {cars.map((car) => (
                  <div key={car.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {car.nickname || `${car.brand || ""} ${car.model || ""}`.trim() || "Mi auto"}
                      </p>
                      <p className="text-xs text-muted-foreground">{[car.plate, car.color].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCarModal(car)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCar(car.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => openCarModal()}
                className="w-full py-6 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors text-sm"
              >
                <Plus className="w-5 h-5 mx-auto mb-1" />
                Agregar mi primer auto
              </button>
            )}
          </Section>

          {/* ═══ ADDRESSES ═══ */}
          <Section
            title={`Direcciones${addresses.length > 0 ? ` (${addresses.length})` : ""}`}
            icon={MapPin}
            defaultOpen={false}
            action={
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openAddressModal()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
              </Button>
            }
          >
            {addresses.length > 0 ? (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <div key={addr.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground">{addr.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{addr.line1}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAddressModal(addr)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteAddress(addr.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => openAddressModal()}
                className="w-full py-6 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors text-sm"
              >
                <Plus className="w-5 h-5 mx-auto mb-1" />
                Agregar mi primera dirección
              </button>
            )}
          </Section>

          {/* ═══ HISTORY ═══ */}
          <Section title="Historial" icon={History} defaultOpen={false}>
            {pastBookings.length > 0 ? (
              <div className="space-y-2">
                {pastBookings.slice(0, 10).map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{b.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(`${b.booking_date}T${b.booking_time}`), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {b.is_subscription_booking ? (
                        <span className="text-xs text-primary flex items-center gap-0.5"><Sparkles className="w-3 h-3" /> Plan</span>
                      ) : b.total_cents ? (
                        <span className="text-sm font-medium text-foreground">${(b.total_cents / 100).toLocaleString("es-AR")}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-sm text-muted-foreground">Sin lavados anteriores</p>
            )}
          </Section>

          {/* ═══ INVOICES ═══ */}
          <Section title="Facturas" icon={FileText} defaultOpen={false}>
            {invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.slice(0, 10).map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(inv.issued_at), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">${inv.amount_ars.toLocaleString("es-AR")}</p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          inv.status === "paid" ? "bg-washero-eco/15 text-washero-eco" :
                          inv.status === "void" ? "bg-destructive/15 text-destructive" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {inv.status === "paid" ? "Pagado" : inv.status === "void" ? "Anulado" : "Pendiente"}
                        </span>
                      </div>
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted">
                          <Download className="w-4 h-4 text-primary" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-sm text-muted-foreground">Sin facturas aún</p>
            )}
          </Section>

          {/* WhatsApp help */}
          <a
            href="https://wa.me/5491112345678?text=Hola,%20necesito%20ayuda"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-washero-eco/10 border border-washero-eco/20 rounded-2xl hover:bg-washero-eco/15 transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-washero-eco shrink-0" />
            <span className="text-sm font-medium text-foreground">¿Necesitás ayuda? Escribinos por WhatsApp</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </a>

        </div>
      </section>

      {/* ═══ MODALS ═══ */}

      {/* Car Modal */}
      <Dialog open={isCarModalOpen} onOpenChange={setIsCarModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCar ? "Editar auto" : "Agregar auto"}</DialogTitle>
            <DialogDescription>Agregá los datos de tu vehículo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Apodo</Label><Input placeholder="Mi auto" value={carForm.nickname} onChange={(e) => setCarForm({ ...carForm, nickname: e.target.value })} /></div>
              <div><Label>Patente</Label><Input placeholder="ABC 123" value={carForm.plate} onChange={(e) => setCarForm({ ...carForm, plate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Marca</Label><Input placeholder="Toyota" value={carForm.brand} onChange={(e) => setCarForm({ ...carForm, brand: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input placeholder="Corolla" value={carForm.model} onChange={(e) => setCarForm({ ...carForm, model: e.target.value })} /></div>
            </div>
            <div><Label>Color</Label><Input placeholder="Blanco" value={carForm.color} onChange={(e) => setCarForm({ ...carForm, color: e.target.value })} /></div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsCarModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSaveCar} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAddress ? "Editar dirección" : "Agregar dirección"}</DialogTitle>
            <DialogDescription>Agregá una dirección para tus lavados</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Etiqueta</Label><Input placeholder="Casa, Oficina..." value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} /></div>
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
            <div><Label>Barrio (opcional)</Label><Input placeholder="Palermo" value={addressForm.neighborhood} onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })} /></div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddressModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSaveAddress} disabled={isSubmitting || !addressForm.line1}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Scheduler */}
      <AnimatePresence>
        {isSubscriptionSchedulerOpen && subscription && user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setIsSubscriptionSchedulerOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-background rounded-t-2xl md:rounded-2xl shadow-xl border border-border"
            >
              <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="font-display text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Agendar lavado de mi plan
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {washesRemaining} lavado{washesRemaining !== 1 ? "s" : ""} restante{washesRemaining !== 1 ? "s" : ""} · {planInfo?.serviceIncluded}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsSubscriptionSchedulerOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-4">
                <SubscriptionCalendarScheduler
                  subscription={{
                    id: subscription.id,
                    plan_id: subscription.plan_code || subscription.plan_id,
                    plan_code: subscription.plan_code || undefined,
                    status: subscription.status,
                    washes_remaining: subscription.washes_remaining,
                    washes_used_this_month: subscription.washes_used_in_cycle,
                    customer_name: subscription.customer_name || undefined,
                    customer_email: subscription.customer_email || undefined,
                    customer_phone: subscription.customer_phone || undefined,
                  }}
                  cars={cars}
                  addresses={addresses}
                  userId={user.id}
                  onBookingComplete={() => {
                    setIsSubscriptionSchedulerOpen(false);
                    fetchUserData(user.id);
                    toast({ title: "¡Lavado agendado!", description: "Tu lavado fue programado correctamente." });
                  }}
                  onNeedsCar={() => { setIsSubscriptionSchedulerOpen(false); openCarModal(); }}
                  onNeedsAddress={() => { setIsSubscriptionSchedulerOpen(false); openAddressModal(); }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
