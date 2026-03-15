import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

export async function validateAvailability(
  supabase: SupabaseClient,
  bookingDate: string,
  bookingTime: string
): Promise<AvailabilityResult> {
  // Check date-level overrides
  const { data: overrideData } = await supabase
    .from("availability_overrides")
    .select("is_closed")
    .eq("date", bookingDate)
    .eq("is_closed", true)
    .maybeSingle();

  if (overrideData) {
    return { available: false, reason: "Esta fecha no está disponible para reservas." };
  }

  // Check slot-level overrides
  const { data: slotOverrideData } = await supabase
    .from("availability_override_slots")
    .select("is_open")
    .eq("date", bookingDate)
    .eq("time", bookingTime)
    .eq("is_open", false)
    .maybeSingle();

  if (slotOverrideData) {
    return { available: false, reason: "Este horario no está disponible." };
  }

  return { available: true };
}
