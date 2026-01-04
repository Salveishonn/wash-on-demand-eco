import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
  CheckCircle,
  Clock,
  LogOut,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  washes_remaining: number;
  washes_used_this_month: number;
  next_wash_at: string | null;
  payment_status: string;
  start_date: string;
}

interface UserCar {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  plate: string | null;
  color: string | null;
  is_default: boolean;
}

interface UserAddress {
  id: string;
  label: string | null;
  line1: string;
  neighborhood: string | null;
  is_default: boolean;
}

interface UpcomingBooking {
  id: string;
  scheduled_at: string;
  service_name: string;
  status: string;
  address_text: string;
}

const PLAN_INFO: Record<string, { name: string; washes: number; price: string }> = {
  basic: { name: "Plan Básico", washes: 2, price: "$55.000" },
  confort: { name: "Plan Confort", washes: 4, price: "$95.000" },
  premium: { name: "Plan Premium", washes: 4, price: "$125.000" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [cars, setCars] = useState<UserCar[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [bookings, setBookings] = useState<UpcomingBooking[]>([]);
  
  // Modal states
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
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
      // Fetch subscription
      const { data: subData } = await supabase
        .from("user_managed_subscriptions")
        .select("*")
        .eq("user_id", userId)
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

      // Fetch upcoming bookings (from main bookings table where user_id matches)
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("id, booking_date, booking_time, service_name, status, address")
        .eq("user_id", userId)
        .gte("booking_date", new Date().toISOString().split("T")[0])
        .order("booking_date", { ascending: true })
        .limit(5);
      
      // Transform to match our interface
      const transformedBookings = (bookingsData || []).map(b => ({
        id: b.id,
        scheduled_at: `${b.booking_date}T${b.booking_time}`,
        service_name: b.service_name,
        status: b.status,
        address_text: b.address || "",
      }));
      setBookings(transformedBookings);
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
      const { error } = await supabase
        .from("user_managed_subscriptions")
        .update({ status: newStatus })
        .eq("id", subscription.id);

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

      toast({
        title: editingCar ? "Auto actualizado" : "Auto agregado",
      });
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
      const { error } = await supabase
        .from("cars")
        .delete()
        .eq("id", carId);
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

  // Address CRUD
  const openAddressModal = (address?: UserAddress) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label || "Casa",
        line1: address.line1,
        neighborhood: address.neighborhood || "",
      });
    } else {
      setEditingAddress(null);
      setAddressForm({ label: "Casa", line1: "", neighborhood: "" });
    }
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!user) return;
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

      toast({
        title: editingAddress ? "Dirección actualizada" : "Dirección agregada",
      });
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
      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", addressId);
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

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const planInfo = subscription ? PLAN_INFO[subscription.plan_id] : null;

  return (
    <Layout>
      {/* Header */}
      <section className="py-8 md:py-12 bg-washero-charcoal">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="font-display text-2xl md:text-3xl font-black text-background">
                Mi <span className="text-primary">Dashboard</span>
              </h1>
              <p className="text-background/70 text-sm mt-1">
                {user?.email}
              </p>
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
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Subscription & Bookings */}
            <div className="lg:col-span-2 space-y-6">
              {/* Subscription Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Mi Plan
                  </h2>
                  {subscription && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSubscriptionPause}
                    >
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
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        subscription.status === "active" 
                          ? "bg-washero-eco/20 text-washero-eco" 
                          : subscription.status === "paused"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {subscription.status === "active" ? "Activo" : 
                         subscription.status === "paused" ? "Pausado" : 
                         subscription.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-primary">
                          {subscription.washes_remaining || planInfo?.washes || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Lavados restantes</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {subscription.washes_used_this_month || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Usados este mes</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      No tenés una suscripción activa
                    </p>
                    <Button onClick={() => navigate("/suscripciones")}>
                      Ver planes
                    </Button>
                  </div>
                )}
              </motion.div>

              {/* Upcoming Bookings */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
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

                {bookings.length > 0 ? (
                  <div className="space-y-3">
                    {bookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {booking.service_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(booking.scheduled_at), "EEEE d MMM, HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          booking.status === "confirmed" 
                            ? "bg-washero-eco/20 text-washero-eco" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {booking.status === "confirmed" ? "Confirmado" : "Pendiente"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No tenés lavados programados</p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Right Column - Cars & Addresses */}
            <div className="space-y-6">
              {/* Cars */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <Car className="w-5 h-5 text-primary" />
                    Mis Autos
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => openCarModal()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {cars.length > 0 ? (
                  <div className="space-y-2">
                    {cars.map((car) => (
                      <div
                        key={car.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {car.nickname || `${car.brand} ${car.model}`}
                          </p>
                          {car.plate && (
                            <p className="text-xs text-muted-foreground">{car.plate}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openCarModal(car)}
                          >
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
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => openCarModal()}
                    className="w-full py-6 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm">Agregar auto</span>
                  </button>
                )}
              </motion.div>

              {/* Addresses */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Mis Direcciones
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => openAddressModal()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {addresses.length > 0 ? (
                  <div className="space-y-2">
                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {address.label}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {address.line1}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openAddressModal(address)}
                          >
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
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => openAddressModal()}
                    className="w-full py-6 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm">Agregar dirección</span>
                  </button>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Car Modal */}
      <Dialog open={isCarModalOpen} onOpenChange={setIsCarModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCar ? "Editar auto" : "Agregar auto"}
            </DialogTitle>
            <DialogDescription>
              Agregá los datos de tu vehículo
            </DialogDescription>
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

      {/* Address Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "Editar dirección" : "Agregar dirección"}
            </DialogTitle>
            <DialogDescription>
              Agregá una dirección para tus lavados
            </DialogDescription>
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
              <Input
                placeholder="Av. Libertador 1234"
                value={addressForm.line1}
                onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
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
            <Button 
              className="flex-1" 
              onClick={handleSaveAddress} 
              disabled={isSubmitting || !addressForm.line1}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
