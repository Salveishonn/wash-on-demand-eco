import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAUNCH_DATE = "2026-04-15";
const FOUNDING_SLOTS_TOTAL = 30;
const FOUNDER_DISCOUNT_PERCENT = 20;

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

    // ---- CHECK CLUSTER DISCOUNT (priority 1: GPS-based) ----
    let clusterApplied = false;
    if (booking.latitude != null && booking.longitude != null) {
      // Get cluster tiers
      const { data: tiers } = await supabase
        .from("cluster_discount_tiers")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      const radius = tiers?.[0]?.radius_km || 5;

      // Count nearby bookings using haversine
      const { data: nearbyCount } = await supabase
        .rpc("count_nearby_bookings", {
          p_date: booking.booking_date,
          p_lat: booking.latitude,
          p_lng: booking.longitude,
          p_radius_km: radius,
          p_exclude_booking_id: bookingId,
        });

      const count = nearbyCount ?? 0;

      // Find matching tier
      const matchingTier = (tiers || [])
        .sort((a: any, b: any) => b.min_nearby - a.min_nearby)
        .find((t: any) => count >= t.min_nearby && (t.max_nearby === null || count <= t.max_nearby));

      const clusterDiscountPercent = matchingTier?.discount_percent || 0;

      console.log("[apply-booking-discount] Cluster nearby:", count, "discount:", clusterDiscountPercent + "%");

      if (clusterDiscountPercent > 0) {
        const discountAmount = Math.round(basePrice * clusterDiscountPercent / 100);
        const finalPrice = basePrice - discountAmount;

        await supabase
          .from("bookings")
          .update({
            discount_type: "cluster",
            discount_percent: clusterDiscountPercent,
            discount_amount_ars: discountAmount,
            final_price_ars: finalPrice,
            cluster_size: count,
            cluster_discount_percent: clusterDiscountPercent,
            discount_locked: true,
          })
          .eq("id", bookingId);

        // Also update nearby bookings that don't have cluster discount yet
        // (they might now qualify for a higher tier)
        const { data: nearbyBookings } = await supabase
          .from("bookings")
          .select("id, total_price_ars, latitude, longitude")
          .eq("booking_date", booking.booking_date)
          .in("status", VALID_STATUSES)
          .eq("is_test", false)
          .neq("id", bookingId)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .eq("discount_locked", false);

        if (nearbyBookings) {
          for (const nb of nearbyBookings) {
            // Check if this booking is within radius
            const { data: dist } = await supabase.rpc("haversine_distance", {
              lat1: booking.latitude,
              lng1: booking.longitude,
              lat2: nb.latitude,
              lng2: nb.longitude,
            });

            if ((dist ?? 999) <= radius) {
              // Recalculate discount for this nearby booking
              const { data: nbCount } = await supabase.rpc("count_nearby_bookings", {
                p_date: booking.booking_date,
                p_lat: nb.latitude,
                p_lng: nb.longitude,
                p_radius_km: radius,
                p_exclude_booking_id: nb.id,
              });

              const nbCountVal = nbCount ?? 0;
              const nbTier = (tiers || [])
                .sort((a: any, b: any) => b.min_nearby - a.min_nearby)
                .find((t: any) => nbCountVal >= t.min_nearby && (t.max_nearby === null || nbCountVal <= t.max_nearby));

              const nbDiscountPercent = nbTier?.discount_percent || 0;
              if (nbDiscountPercent > 0) {
                const nbBase = nb.total_price_ars || 0;
                const nbDiscountAmount = Math.round(nbBase * nbDiscountPercent / 100);
                await supabase
                  .from("bookings")
                  .update({
                    discount_type: "cluster",
                    discount_percent: nbDiscountPercent,
                    discount_amount_ars: nbDiscountAmount,
                    final_price_ars: nbBase - nbDiscountAmount,
                    cluster_size: nbCountVal,
                    cluster_discount_percent: nbDiscountPercent,
                    discount_locked: true,
                  })
                  .eq("id", nb.id)
                  .eq("discount_locked", false);
              }
            }
          }
        }

        clusterApplied = true;
      }
    }

    // ---- CHECK FOUNDER DISCOUNT (priority 2: 20% OFF) ----
    if (!clusterApplied) {
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
      .select("id, discount_type, discount_percent, discount_amount_ars, final_price_ars, is_launch_founder_slot, cluster_size, cluster_discount_percent")
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
