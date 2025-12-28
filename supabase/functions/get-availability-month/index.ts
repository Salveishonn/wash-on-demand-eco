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
  surchargeAmount: number | null;
  surchargePercent: number | null;
  note: string | null;
}

interface AvailabilityRule {
  weekday: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
  slot_interval_minutes: number;
}

interface AvailabilityOverride {
  date: string;
  is_closed: boolean;
  note: string | null;
  surcharge_amount: number | null;
  surcharge_percent: number | null;
}

interface SlotOverride {
  date: string;
  time: string;
  is_open: boolean;
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

// Get total slots for a specific date based on rules and overrides
function getAvailabilityForDate(
  date: string, 
  rules: Map<number, AvailabilityRule>,
  overrides: Map<string, AvailabilityOverride>,
  slotOverrides: Map<string, SlotOverride[]>
): { slots: string[]; closed: boolean; override: AvailabilityOverride | null } {
  const d = new Date(date + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay();
  
  // Check if there's a date override
  const override = overrides.get(date);
  if (override?.is_closed) {
    return { slots: [], closed: true, override };
  }
  
  // Get weekly rule
  const rule = rules.get(dayOfWeek);
  if (!rule || !rule.is_open) {
    return { slots: [], closed: true, override: override || null };
  }
  
  // Generate base slots from rule
  let slots = generateTimeSlots(rule.start_time, rule.end_time, rule.slot_interval_minutes);
  
  // Apply slot-level overrides
  const dateSlotOverrides = slotOverrides.get(date) || [];
  if (dateSlotOverrides.length > 0) {
    const closedSlots = new Set(
      dateSlotOverrides.filter(so => !so.is_open).map(so => so.time)
    );
    const addedSlots = dateSlotOverrides
      .filter(so => so.is_open && !slots.includes(so.time))
      .map(so => so.time);
    
    slots = slots.filter(s => !closedSlots.has(s));
    slots = [...slots, ...addedSlots].sort();
  }
  
  return { slots, closed: false, override: override || null };
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

    // Fetch availability rules
    const { data: rulesData, error: rulesError } = await supabase
      .from("availability_rules")
      .select("*");

    if (rulesError) {
      console.error("[get-availability-month] Rules query error:", rulesError);
      throw rulesError;
    }

    const rules = new Map<number, AvailabilityRule>();
    for (const rule of rulesData || []) {
      rules.set(rule.weekday, rule);
    }

    // Fetch date overrides for the range
    const { data: overridesData, error: overridesError } = await supabase
      .from("availability_overrides")
      .select("*")
      .gte("date", from)
      .lte("date", to);

    if (overridesError) {
      console.error("[get-availability-month] Overrides query error:", overridesError);
      throw overridesError;
    }

    const overrides = new Map<string, AvailabilityOverride>();
    for (const override of overridesData || []) {
      overrides.set(override.date, override);
    }

    // Fetch slot overrides for the range
    const { data: slotOverridesData, error: slotOverridesError } = await supabase
      .from("availability_override_slots")
      .select("*")
      .gte("date", from)
      .lte("date", to);

    if (slotOverridesError) {
      console.error("[get-availability-month] Slot overrides query error:", slotOverridesError);
      throw slotOverridesError;
    }

    const slotOverrides = new Map<string, SlotOverride[]>();
    for (const so of slotOverridesData || []) {
      if (!slotOverrides.has(so.date)) {
        slotOverrides.set(so.date, []);
      }
      slotOverrides.get(so.date)!.push(so);
    }

    // Query all bookings in the date range (excluding cancelled)
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("booking_date, booking_time")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .in("status", ["pending", "confirmed"]);

    if (bookingsError) {
      console.error("[get-availability-month] Bookings query error:", bookingsError);
      throw bookingsError;
    }

    // Count bookings per date
    const bookingsPerDate: Record<string, Set<string>> = {};
    for (const booking of bookings || []) {
      const date = booking.booking_date;
      if (!bookingsPerDate[date]) {
        bookingsPerDate[date] = new Set();
      }
      bookingsPerDate[date].add(booking.booking_time);
    }

    // Generate availability for each date in range
    const dates = getDateRange(from, to);
    const availability: DayAvailability[] = dates.map(date => {
      const { slots, closed, override } = getAvailabilityForDate(date, rules, overrides, slotOverrides);
      const bookedTimes = bookingsPerDate[date] || new Set();
      const bookedCount = slots.filter(s => bookedTimes.has(s)).length;

      return {
        date,
        closed,
        totalSlots: slots.length,
        bookedSlots: bookedCount,
        availableSlots: Math.max(0, slots.length - bookedCount),
        surchargeAmount: override?.surcharge_amount || null,
        surchargePercent: override?.surcharge_percent || null,
        note: override?.note || null,
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
