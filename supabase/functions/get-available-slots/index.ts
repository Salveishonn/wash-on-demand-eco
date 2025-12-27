import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlotInfo {
  time: string;
  status: "available" | "booked";
}

// Generate slots based on day of week
function generateSlots(date: string): string[] {
  const d = new Date(date + "T12:00:00Z"); // Use noon UTC to avoid timezone issues
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 6 = Saturday

  if (dayOfWeek === 0) {
    // Sunday - closed
    return [];
  }

  if (dayOfWeek === 6) {
    // Saturday: 08:00 to 11:00 (4 slots)
    return ["08:00", "09:00", "10:00", "11:00"];
  }

  // Monday-Friday: 08:00 to 17:00 (10 slots)
  return [
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00"
  ];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");

    if (!date) {
      return new Response(
        JSON.stringify({ error: "Missing 'date' query parameter (YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return new Response(
        JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all possible slots for this day
    const allSlots = generateSlots(date);

    if (allSlots.length === 0) {
      // Sunday - closed
      return new Response(
        JSON.stringify({ date, closed: true, slots: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query booked slots for this date (excluding cancelled)
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("booking_time")
      .eq("booking_date", date)
      .in("status", ["pending", "confirmed"]);

    if (error) {
      console.error("[get-available-slots] Query error:", error);
      throw error;
    }

    const bookedTimes = new Set(bookings?.map(b => b.booking_time) || []);

    // Build slots array
    const slots: SlotInfo[] = allSlots.map(time => ({
      time,
      status: bookedTimes.has(time) ? "booked" : "available"
    }));

    const availableCount = slots.filter(s => s.status === "available").length;

    console.log(`[get-available-slots] Date ${date}: ${availableCount}/${allSlots.length} available`);

    return new Response(
      JSON.stringify({ 
        date, 
        closed: false,
        totalSlots: allSlots.length,
        availableSlots: availableCount,
        slots 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[get-available-slots] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});