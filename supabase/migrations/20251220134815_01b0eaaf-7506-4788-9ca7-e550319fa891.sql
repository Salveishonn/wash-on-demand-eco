-- Crear enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Crear tabla de roles de usuario
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Función para verificar si un usuario tiene un rol específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Política: los usuarios pueden ver sus propios roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Política: solo admins pueden ver todos los roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Política: solo admins pueden insertar roles
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Política: solo admins pueden eliminar roles
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Agregar política para que admins puedan ver todas las reservas
CREATE POLICY "Admins can view all bookings"
  ON public.bookings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Agregar política para que admins puedan actualizar reservas
CREATE POLICY "Admins can update all bookings"
  ON public.bookings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Agregar política para que admins puedan ver todos los logs
CREATE POLICY "Admins can view all notification logs"
  ON public.notification_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));