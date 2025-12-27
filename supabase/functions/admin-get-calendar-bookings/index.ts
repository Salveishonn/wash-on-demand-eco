import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarFilters {
  from: string; // ISO date string YYYY-MM-DD
  to: string; // ISO date string YYYY-MM-DD
  booking_status?: string[];
  payment_status?: string[];
  payment_method?: string[];
  service_name?: string[];
  subscription_only?: boolean;
  search?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase client USING USER SESSION (this is the key fix)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin role check
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query from the view
    let query = supabase
      .from("calendar_bookings_v")
      .select("*")
      .gte("booking_date", filters.from)
      .lte("booking_date", filters.to)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });

    // Apply optional filters
    if (filters.booking_status && filters.booking_status.length > 0) {
      query = query.in("booking_status", filters.booking_status);
    }

    if (filters.payment_status && filters.payment_status.length > 0) {
      query = query.in("payment_status", filters.payment_status);
    }

    if (filters.payment_method && filters.payment_method.length > 0) {
      query = query.in("payment_method", filters.payment_method);
    }

    if (filters.service_name && filters.service_name.length > 0) {
      query = query.in("service_name", filters.service_name);
    }

    if (filters.subscription_only === true) {
      query = query.eq("is_subscription_booking", true);
    }

    if (filters.search) {
      query = query.or(
        `customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,address.ilike.%${filters.search}%`,
      );
    }

    const { data: bookings, error: queryError } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(JSON.stringify({ error: "Error fetching bookings", details: queryError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${bookings?.length || 0} calendar bookings`);

    return new Response(JSON.stringify({ bookings: bookings || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in admin-get-calendar-bookings:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
