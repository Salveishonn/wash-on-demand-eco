import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DayAvailability {
  date: string;
  closed: boolean;
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
}

// Get total slots for a specific date based on day of week
function getTotalSlotsForDate(date: string): { total: number; closed: boolean } {
  const d = new Date(date + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay();

  if (dayOfWeek === 0) {
    return { total: 0, closed: true }; // Sunday
  }
  if (dayOfWeek === 6) {
    return { total: 4, closed: false }; // Saturday: 08-11 (4 slots)
  }
  return { total: 10, closed: false }; // Mon-Fri: 08-17 (10 slots)
}

// Generate array of dates between from and to (inclusive)
function getDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z");

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) {
      return new Response(
        JSON.stringify({ error: "Missing 'from' and/or 'to' query parameters (YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query all bookings in the date range (excluding cancelled)
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("booking_date, booking_time")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .in("status", ["pending", "confirmed"]);

    if (error) {
      console.error("[get-availability-month] Query error:", error);
      throw error;
    }

    // Count bookings per date
    const bookingsPerDate: Record<string, number> = {};
    for (const booking of bookings || []) {
      const date = booking.booking_date;
      bookingsPerDate[date] = (bookingsPerDate[date] || 0) + 1;
    }

    // Generate availability for each date in range
    const dates = getDateRange(from, to);
    const availability: DayAvailability[] = dates.map(date => {
      const { total, closed } = getTotalSlotsForDate(date);
      const booked = bookingsPerDate[date] || 0;

      return {
        date,
        closed,
        totalSlots: total,
        bookedSlots: booked,
        availableSlots: Math.max(0, total - booked)
      };
    });

    console.log(`[get-availability-month] Range ${from} to ${to}: ${dates.length} days processed`);

    return new Response(
      JSON.stringify({ from, to, availability }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[get-availability-month] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});