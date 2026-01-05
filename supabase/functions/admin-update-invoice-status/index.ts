import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateInvoiceRequest {
  invoice_id: string;
  status: "paid" | "void";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { invoice_id, status }: UpdateInvoiceRequest = await req.json();

    console.log("[admin-update-invoice-status] Request:", { invoice_id, status });

    if (!invoice_id || !status) {
      throw new Error("invoice_id y status son requeridos");
    }

    if (!["paid", "void"].includes(status)) {
      throw new Error("status debe ser 'paid' o 'void'");
    }

    // Get the invoice
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("*, bookings(*)")
      .eq("id", invoice_id)
      .single();

    if (fetchError || !invoice) {
      throw new Error("Factura no encontrada");
    }

    const oldStatus = invoice.status;

    // Update invoice
    const updateData: Record<string, unknown> = {
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    };

    const { error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoice_id);

    if (updateError) {
      throw new Error(`Error actualizando factura: ${updateError.message}`);
    }

    // If marking as paid and has booking, update booking payment status
    if (status === "paid" && invoice.booking_id) {
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({ 
          payment_status: "approved",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", invoice.booking_id);

      if (bookingError) {
        console.error("[admin-update-invoice-status] Booking update error:", bookingError);
      }

      // Emit booking.paid event
      const notifyUrl = `${supabaseUrl}/functions/v1/notify-event`;
      fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          event: "booking.paid",
          timestamp: new Date().toISOString(),
          booking_id: invoice.booking_id,
          invoice_id: invoice.id,
          amount_ars: invoice.amount_ars,
          customer_email: invoice.bookings?.customer_email,
          customer_phone: invoice.bookings?.customer_phone,
        }),
      }).catch(err => console.error("[admin-update-invoice-status] Notify error:", err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Factura ${invoice.invoice_number} marcada como ${status === "paid" ? "pagada" : "anulada"}`,
        old_status: oldStatus,
        new_status: status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[admin-update-invoice-status] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
