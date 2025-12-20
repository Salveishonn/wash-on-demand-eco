-- Crear enum para estados de reserva
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Crear enum para estados de pago
CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected', 'refunded', 'in_process');

-- Crear enum para estados de suscripción
CREATE TYPE public.subscription_status AS ENUM ('active', 'paused', 'cancelled', 'payment_failed');

-- Crear enum para tipos de notificación
CREATE TYPE public.notification_type AS ENUM ('email', 'whatsapp');

-- Crear enum para estados de notificación
CREATE TYPE public.notification_status AS ENUM ('sent', 'failed', 'pending');

-- Tabla de perfiles de usuario
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de planes de suscripción
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  washes_per_month INTEGER NOT NULL,
  mercadopago_plan_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de suscripciones de usuarios
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  mercadopago_subscription_id TEXT,
  washes_remaining INTEGER NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de reservas
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  
  -- Datos del cliente
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  
  -- Datos del servicio
  service_name TEXT NOT NULL,
  service_price_cents INTEGER NOT NULL,
  car_type TEXT,
  car_type_extra_cents INTEGER DEFAULT 0,
  
  -- Fecha y ubicación
  booking_date DATE NOT NULL,
  booking_time TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  
  -- Estados
  status booking_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  mercadopago_payment_id TEXT,
  mercadopago_preference_id TEXT,
  
  -- Flags
  is_subscription_booking BOOLEAN DEFAULT false,
  requires_payment BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

-- Tabla de logs de notificaciones
CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  recipient TEXT NOT NULL,
  message_content TEXT,
  error_message TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Políticas para subscription_plans (públicamente visibles)
CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- Políticas para subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Políticas para bookings
CREATE POLICY "Users can view their own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Políticas para notification_logs (solo lectura para usuarios autenticados)
CREATE POLICY "Authenticated users can view notification logs"
  ON public.notification_logs FOR SELECT
  TO authenticated
  USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Función para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger para crear perfil en registro
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insertar planes de suscripción iniciales
INSERT INTO public.subscription_plans (name, description, price_cents, washes_per_month) VALUES
  ('Básico', '2 lavados por mes - Ideal para uso ocasional', 2500000, 2),
  ('Premium', '4 lavados por mes - Para quienes cuidan su auto', 4500000, 4);