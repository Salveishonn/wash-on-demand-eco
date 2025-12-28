import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlotInfo {
  time: string;
  status: "available" | "booked" | "closed";
  reason?: string;
}

interface AvailabilityRule {
  weekday: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
  slot_interval_minutes: number;
}

// Generate time slots based on start/end time and interval
function generateTimeSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  while (currentMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`);
    currentMinutes += intervalMinutes;
  }
  
  return slots;
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

    const d = new Date(date + "T12:00:00Z");
    const dayOfWeek = d.getUTCDay();

    // Fetch the availability rule for this weekday
    const { data: ruleData, error: ruleError } = await supabase
      .from("availability_rules")
      .select("*")
      .eq("weekday", dayOfWeek)
      .single();

    if (ruleError && ruleError.code !== "PGRST116") {
      console.error("[get-available-slots] Rule query error:", ruleError);
      throw ruleError;
    }

    // Check for date override
    const { data: overrideData, error: overrideError } = await supabase
      .from("availability_overrides")
      .select("*")
      .eq("date", date)
      .single();

    if (overrideError && overrideError.code !== "PGRST116") {
      console.error("[get-available-slots] Override query error:", overrideError);
      throw overrideError;
    }

    // If day is closed by override
    if (overrideData?.is_closed) {
      return new Response(
        JSON.stringify({ 
          date, 
          closed: true, 
          reason: overrideData.note || "Cerrado",
          slots: [],
          surchargeAmount: null,
          surchargePercent: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no rule or rule says closed
    if (!ruleData || !ruleData.is_open) {
      return new Response(
        JSON.stringify({ date, closed: true, reason: "Cerrado por horario regular", slots: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate base slots from rule
    let allSlots = generateTimeSlots(ruleData.start_time, ruleData.end_time, ruleData.slot_interval_minutes);

    // Fetch slot-level overrides
    const { data: slotOverrides, error: slotOverridesError } = await supabase
      .from("availability_override_slots")
      .select("*")
      .eq("date", date);

    if (slotOverridesError) {
      console.error("[get-available-slots] Slot overrides query error:", slotOverridesError);
      throw slotOverridesError;
    }

    // Create sets for closed and added slots
    const closedSlots = new Set<string>();
    const addedSlots: string[] = [];
    
    for (const so of slotOverrides || []) {
      if (!so.is_open) {
        closedSlots.add(so.time);
      } else if (!allSlots.includes(so.time)) {
        addedSlots.push(so.time);
      }
    }

    // Remove closed slots and add opened ones
    allSlots = allSlots.filter(s => !closedSlots.has(s));
    allSlots = [...allSlots, ...addedSlots].sort();

    if (allSlots.length === 0) {
      return new Response(
        JSON.stringify({ 
          date, 
          closed: true, 
          reason: "Sin horarios disponibles", 
          slots: [],
          surchargeAmount: overrideData?.surcharge_amount || null,
          surchargePercent: overrideData?.surcharge_percent || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query booked slots for this date (excluding cancelled)
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("booking_time")
      .eq("booking_date", date)
      .in("status", ["pending", "confirmed"]);

    if (bookingsError) {
      console.error("[get-available-slots] Bookings query error:", bookingsError);
      throw bookingsError;
    }

    const bookedTimes = new Set(bookings?.map(b => b.booking_time) || []);

    // Build slots array with status and reason
    const slots: SlotInfo[] = allSlots.map(time => {
      if (bookedTimes.has(time)) {
        return { time, status: "booked" as const, reason: "Reservado" };
      }
      if (closedSlots.has(time)) {
        return { time, status: "closed" as const, reason: "Bloqueado" };
      }
      return { time, status: "available" as const };
    });

    const availableCount = slots.filter(s => s.status === "available").length;

    console.log(`[get-available-slots] Date ${date}: ${availableCount}/${allSlots.length} available`);

    return new Response(
      JSON.stringify({ 
        date, 
        closed: false,
        totalSlots: allSlots.length,
        availableSlots: availableCount,
        slots,
        surchargeAmount: overrideData?.surcharge_amount || null,
        surchargePercent: overrideData?.surcharge_percent || null,
        note: overrideData?.note || null,
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
