import { supabase } from "@/integrations/supabase/client";

export type NotificationType = "ON_MY_WAY";

interface SendNotificationResult {
  ok: boolean;
  channel?: string;
  message?: string;
  stored?: boolean;
  sent?: boolean;
  error?: string;
}

export async function sendCustomerNotification(
  bookingId: string,
  type: NotificationType
): Promise<SendNotificationResult> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      return { ok: false, error: "No hay sesión activa" };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    const response = await fetch(
      `${supabaseUrl}/functions/v1/admin-send-customer-notification`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ booking_id: bookingId, type }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return { ok: false, error: result.error || "Error al enviar notificación" };
    }

    return result;
  } catch (error) {
    console.error("sendCustomerNotification error:", error);
    return { ok: false, error: String(error) };
  }
}
