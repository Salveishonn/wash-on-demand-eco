import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAUNCH_DATE = "2026-04-15";
const FOUNDING_SLOTS_TOTAL = 30;
const FOUNDER_DISCOUNT_PERCENT = 20;
const BARRIO_DISCOUNT_PERCENT = 30;
const BARRIO_THRESHOLD = 3;

// Valid statuses that count as real reservations
const VALID_STATUSES = ["pending", "confirmed", "completed"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { bookingId } = await req.json();
    if (!bookingId) throw new Error("bookingId is required");

    console.log("[apply-booking-discount] Processing booking:", bookingId);

    // Fetch the booking
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) throw new Error("Booking not found");

    // If discount is locked, skip
    if (booking.discount_locked) {
      console.log("[apply-booking-discount] Discount already locked, skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "locked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip test/cancelled bookings
    if (booking.is_test || !VALID_STATUSES.includes(booking.status)) {
      console.log("[apply-booking-discount] Not eligible (test or invalid status)");
      return new Response(JSON.stringify({ skipped: true, reason: "not_eligible" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip bookings before launch
    if (booking.booking_date < LAUNCH_DATE) {
      console.log("[apply-booking-discount] Before launch date, skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "before_launch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const basePrice = booking.total_price_ars || 0;

    // ---- CHECK BARRIO DISCOUNT (priority 1: 30% OFF) ----
    let barrioApplied = false;
    if (booking.barrio && booking.barrio.trim() !== "") {
      const normalizedBarrio = booking.barrio.trim().toLowerCase();
      const groupKey = `${normalizedBarrio}::${booking.booking_date}`;

      // Count valid bookings in same barrio + same date
      const { count: barrioCount } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("booking_date", booking.booking_date)
        .ilike("barrio", normalizedBarrio)
        .in("status", VALID_STATUSES)
        .eq("is_test", false);

      const totalInGroup = barrioCount ?? 0;
      console.log("[apply-booking-discount] Barrio group count:", totalInGroup, "for", groupKey);

      if (totalInGroup >= BARRIO_THRESHOLD) {
        const discountAmount = Math.round(basePrice * BARRIO_DISCOUNT_PERCENT / 100);
        const finalPrice = basePrice - discountAmount;

        // Update THIS booking
        await supabase
          .from("bookings")
          .update({
            discount_type: "barrio",
            discount_percent: BARRIO_DISCOUNT_PERCENT,
            discount_amount_ars: discountAmount,
            final_price_ars: finalPrice,
            barrio_discount_qualified_at: new Date().toISOString(),
            barrio_group_key: groupKey,
            discount_locked: true,
          })
          .eq("id", bookingId);

        // Also update OTHER bookings in the same group that don't have barrio discount yet
        const { data: groupBookings } = await supabase
          .from("bookings")
          .select("id, total_price_ars")
          .eq("booking_date", booking.booking_date)
          .ilike("barrio", normalizedBarrio)
          .in("status", VALID_STATUSES)
          .eq("is_test", false)
          .neq("id", bookingId)
          .or("discount_type.is.null,discount_type.neq.barrio");

        if (groupBookings && groupBookings.length > 0) {
          for (const gb of groupBookings) {
            const gbBase = gb.total_price_ars || 0;
            const gbDiscount = Math.round(gbBase * BARRIO_DISCOUNT_PERCENT / 100);
            await supabase
              .from("bookings")
              .update({
                discount_type: "barrio",
                discount_percent: BARRIO_DISCOUNT_PERCENT,
                discount_amount_ars: gbDiscount,
                final_price_ars: gbBase - gbDiscount,
                barrio_discount_qualified_at: new Date().toISOString(),
                barrio_group_key: groupKey,
                discount_locked: true,
              })
              .eq("id", gb.id)
              .eq("discount_locked", false);
          }
          console.log("[apply-booking-discount] Updated", groupBookings.length, "other barrio bookings");
        }

        barrioApplied = true;
      }
    }

    // ---- CHECK FOUNDER DISCOUNT (priority 2: 20% OFF) ----
    if (!barrioApplied) {
      // Count existing founder slots
      const { count: founderCount } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("is_launch_founder_slot", true)
        .eq("is_test", false)
        .in("status", VALID_STATUSES);

      const currentFounderCount = founderCount ?? 0;
      console.log("[apply-booking-discount] Founder slots used:", currentFounderCount);

      if (currentFounderCount < FOUNDING_SLOTS_TOTAL) {
        const discountAmount = Math.round(basePrice * FOUNDER_DISCOUNT_PERCENT / 100);
        const finalPrice = basePrice - discountAmount;

        await supabase
          .from("bookings")
          .update({
            discount_type: "launch_founder",
            discount_percent: FOUNDER_DISCOUNT_PERCENT,
            discount_amount_ars: discountAmount,
            final_price_ars: finalPrice,
            is_launch_founder_slot: true,
            discount_locked: true,
          })
          .eq("id", bookingId);

        console.log("[apply-booking-discount] Founder discount applied:", discountAmount);
      } else {
        // No discount, just set final_price = total
        await supabase
          .from("bookings")
          .update({
            final_price_ars: basePrice,
            discount_type: null,
            discount_percent: 0,
            discount_amount_ars: 0,
          })
          .eq("id", bookingId);

        console.log("[apply-booking-discount] No discount available");
      }
    }

    // Get updated booking for response
    const { data: updated } = await supabase
      .from("bookings")
      .select("id, discount_type, discount_percent, discount_amount_ars, final_price_ars, is_launch_founder_slot")
      .eq("id", bookingId)
      .single();

    return new Response(JSON.stringify({ success: true, booking: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[apply-booking-discount] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
