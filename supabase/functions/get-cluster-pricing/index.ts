import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const lat = parseFloat(url.searchParams.get("lat") || "");
    const lng = parseFloat(url.searchParams.get("lng") || "");

    if (!date || isNaN(lat) || isNaN(lng)) {
      return new Response(
        JSON.stringify({ error: "Missing date, lat, or lng parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get cluster discount tiers
    const { data: tiers } = await supabase
      .from("cluster_discount_tiers")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    const defaultRadius = tiers?.[0]?.radius_km || 5;

    // Count nearby bookings using DB function
    const { data: nearbyCount } = await supabase
      .rpc("count_nearby_bookings", {
        p_date: date,
        p_lat: lat,
        p_lng: lng,
        p_radius_km: defaultRadius,
      });

    const count = nearbyCount ?? 0;

    // Find matching tier
    const matchingTier = tiers
      ?.sort((a: any, b: any) => b.min_nearby - a.min_nearby)
      .find((t: any) => count >= t.min_nearby && (t.max_nearby === null || count <= t.max_nearby));

    const discountPercent = matchingTier?.discount_percent || 0;
    const label = matchingTier?.label || "Sin descuento";
    const emoji = matchingTier?.emoji || "";

    console.log(`[get-cluster-pricing] date=${date} lat=${lat} lng=${lng} nearby=${count} discount=${discountPercent}%`);

    return new Response(
      JSON.stringify({
        date,
        nearbyCount: count,
        discountPercent,
        label,
        emoji,
        radiusKm: defaultRadius,
        tiers: tiers?.map((t: any) => ({
          minNearby: t.min_nearby,
          maxNearby: t.max_nearby,
          discountPercent: t.discount_percent,
          label: t.label,
          emoji: t.emoji,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[get-cluster-pricing] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
