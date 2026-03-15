import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Spanish day name helper
function formatDayName(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return days[date.getDay()];
  } catch {
    return dateStr;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find bookings starting in the next 25-35 minutes that haven't been reminded
    // We use a window to account for cron execution timing
    const now = new Date();
    const from30 = new Date(now.getTime() + 25 * 60 * 1000);
    const to30 = new Date(now.getTime() + 35 * 60 * 1000);

    // Get today's date in YYYY-MM-DD (Argentina timezone approximation)
    const argNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const todayStr = `${argNow.getFullYear()}-${String(argNow.getMonth() + 1).padStart(2, "0")}-${String(argNow.getDate()).padStart(2, "0")}`;

    // Get current time in HH:MM for comparison (Argentina time)
    const argHours = argNow.getHours();
    const argMinutes = argNow.getMinutes();
    
    // Window: 25-35 min from now
    const fromMinutes = argHours * 60 + argMinutes + 25;
    const toMinutes = argHours * 60 + argMinutes + 35;
    
    const fromTime = `${String(Math.floor(fromMinutes / 60)).padStart(2, "0")}:${String(fromMinutes % 60).padStart(2, "0")}`;
    const toTime = `${String(Math.floor(toMinutes / 60)).padStart(2, "0")}:${String(toMinutes % 60).padStart(2, "0")}`;

    console.log(`[booking-reminders] Checking for bookings on ${todayStr} between ${fromTime} and ${toTime}`);

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, booking_date, booking_time, address, barrio, service_name, customer_name, is_test")
      .eq("booking_date", todayStr)
      .gte("booking_time", fromTime)
      .lte("booking_time", toTime)
      .in("status", ["confirmed", "accepted", "pending"])
      .eq("is_test", false);

    if (error) {
      console.error("[booking-reminders] Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bookings || bookings.length === 0) {
      console.log("[booking-reminders] No upcoming bookings found");
      return new Response(JSON.stringify({ success: true, reminders_sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[booking-reminders] Found ${bookings.length} upcoming bookings`);

    let sent = 0;
    for (const booking of bookings) {
      // Check if reminder was already sent (use operator_notifications to avoid duplicates)
      const reminderKey = `reminder_${booking.id}_${todayStr}`;
      const { data: existing } = await supabase
        .from("operator_notifications")
        .select("id")
        .eq("event_type", "booking_reminder")
        .contains("data", { booking_id: booking.id, reminder_date: todayStr })
        .maybeSingle();

      if (existing) {
        console.log(`[booking-reminders] Reminder already sent for booking ${booking.id}`);
        continue;
      }

      const location = booking.barrio || booking.address?.split(",")[0] || "";
      const body = location;

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-ops-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            event_type: "booking_reminder",
            title: "⏰ Lavado en 30 min",
            body: body,
            tag: "booking-reminder",
            url: "/ops/agenda",
            requireInteraction: false,
            data: {
              url: "/ops/agenda",
              booking_id: booking.id,
              reminder_date: todayStr,
            },
          }),
        });
        sent++;
        console.log(`[booking-reminders] Reminder sent for booking ${booking.id}`);
      } catch (err: any) {
        console.error(`[booking-reminders] Failed to send reminder for ${booking.id}:`, err.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sent, total_bookings: bookings.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[booking-reminders] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
