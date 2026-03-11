import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateWeeklyRulePayload {
  type: "weekly_rule";
  weekday: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
  slot_interval_minutes?: number;
}

interface UpdateDateOverridePayload {
  type: "date_override";
  date: string;
  is_closed: boolean;
  note?: string;
  surcharge_amount?: number;
  surcharge_percent?: number;
}

interface UpdateSlotOverridePayload {
  type: "slot_override";
  date: string;
  time: string;
  is_open: boolean;
}

interface DeleteDateOverridePayload {
  type: "delete_date_override";
  date: string;
}

interface DeleteSlotOverridePayload {
  type: "delete_slot_override";
  date: string;
  time: string;
}

interface BlockDateRangePayload {
  type: "block_date_range";
  from_date: string;
  to_date: string;
  note?: string;
}

interface UnblockDateRangePayload {
  type: "unblock_date_range";
  from_date: string;
  to_date: string;
}

type Payload = 
  | UpdateWeeklyRulePayload 
  | UpdateDateOverridePayload 
  | UpdateSlotOverridePayload
  | DeleteDateOverridePayload
  | DeleteSlotOverridePayload
  | BlockDateRangePayload
  | UnblockDateRangePayload;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user and check admin role
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    
    if (userError || !userData.user) {
      console.error("[admin-update-availability] Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("[admin-update-availability] Not admin:", roleError);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const payload: Payload = await req.json();
    console.log("[admin-update-availability] Payload:", payload);

    let result: any = null;

    switch (payload.type) {
      case "weekly_rule": {
        const { weekday, is_open, start_time, end_time, slot_interval_minutes } = payload;
        
        // Upsert the weekly rule
        const { data, error } = await supabase
          .from("availability_rules")
          .upsert({
            weekday,
            is_open,
            start_time,
            end_time,
            slot_interval_minutes: slot_interval_minutes || 60,
            updated_at: new Date().toISOString(),
          }, { onConflict: "weekday" })
          .select()
          .single();

        if (error) {
          console.error("[admin-update-availability] Weekly rule error:", error);
          throw error;
        }

        result = { message: "Weekly rule updated", rule: data };
        break;
      }

      case "date_override": {
        const { date, is_closed, note, surcharge_amount, surcharge_percent } = payload;
        
        // Upsert the date override
        const { data, error } = await supabase
          .from("availability_overrides")
          .upsert({
            date,
            is_closed,
            note: note || null,
            surcharge_amount: surcharge_amount || null,
            surcharge_percent: surcharge_percent || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "date" })
          .select()
          .single();

        if (error) {
          console.error("[admin-update-availability] Date override error:", error);
          throw error;
        }

        result = { message: "Date override updated", override: data };
        break;
      }

      case "slot_override": {
        const { date, time, is_open } = payload;
        
        // Upsert the slot override
        const { data, error } = await supabase
          .from("availability_override_slots")
          .upsert({
            date,
            time,
            is_open,
          }, { onConflict: "date,time" })
          .select()
          .single();

        if (error) {
          console.error("[admin-update-availability] Slot override error:", error);
          throw error;
        }

        result = { message: "Slot override updated", slotOverride: data };
        break;
      }

      case "delete_date_override": {
        const { date } = payload;
        
        // Delete the date override
        const { error } = await supabase
          .from("availability_overrides")
          .delete()
          .eq("date", date);

        if (error) {
          console.error("[admin-update-availability] Delete date override error:", error);
          throw error;
        }

        // Also delete any slot overrides for that date
        await supabase
          .from("availability_override_slots")
          .delete()
          .eq("date", date);

        result = { message: "Date override deleted", date };
        break;
      }

      case "delete_slot_override": {
        const { date, time } = payload;
        
        // Delete the slot override
        const { error } = await supabase
          .from("availability_override_slots")
          .delete()
          .eq("date", date)
          .eq("time", time);

        if (error) {
          console.error("[admin-update-availability] Delete slot override error:", error);
          throw error;
        }

        result = { message: "Slot override deleted", date, time };
        break;
      }

      case "block_date_range": {
        const { from_date, to_date, note } = payload as BlockDateRangePayload;
        
        // Generate date array
        const dates: string[] = [];
        const current = new Date(from_date + "T12:00:00Z");
        const end = new Date(to_date + "T12:00:00Z");
        while (current <= end) {
          dates.push(current.toISOString().split("T")[0]);
          current.setUTCDate(current.getUTCDate() + 1);
        }

        // Upsert all dates as closed
        const rows = dates.map(d => ({
          date: d,
          is_closed: true,
          note: note || "Bloqueado por rango",
          updated_at: new Date().toISOString(),
        }));

        for (const row of rows) {
          const { error } = await supabase
            .from("availability_overrides")
            .upsert(row, { onConflict: "date" });
          if (error) {
            console.error("[admin-update-availability] Block range error for", row.date, error);
          }
        }

        result = { message: `Blocked ${dates.length} dates from ${from_date} to ${to_date}`, count: dates.length };
        break;
      }

      case "unblock_date_range": {
        const { from_date, to_date } = payload as UnblockDateRangePayload;
        
        const { error, count } = await supabase
          .from("availability_overrides")
          .delete()
          .gte("date", from_date)
          .lte("date", to_date)
          .eq("is_closed", true);

        if (error) {
          console.error("[admin-update-availability] Unblock range error:", error);
          throw error;
        }

        // Also delete slot overrides in range
        await supabase
          .from("availability_override_slots")
          .delete()
          .gte("date", from_date)
          .lte("date", to_date);

        result = { message: `Unblocked dates from ${from_date} to ${to_date}`, count };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid payload type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ ok: true, ...result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[admin-update-availability] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
