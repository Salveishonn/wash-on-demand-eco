import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin contact info
const ADMIN_EMAIL = "washerocarwash@gmail.com";
const ADMIN_WHATSAPP = "+5491130951804";

async function sendEmail(
  resendApiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Washero <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.message || "Email send failed" };
    }
    
    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendWhatsApp(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const formattedTo = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: `whatsapp:${fromNumber}`,
        To: `whatsapp:${formattedTo}`,
        Body: body,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || JSON.stringify(data) };
    }

    return { success: true, sid: data.sid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { testMode, bookingId } = body;

    console.log("[send-notifications] Request received, testMode:", testMode, "bookingId:", bookingId);

    if (testMode) {
      // Send test notifications to admin
      const testSubject = "🧪 Test Notification - Washero";
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: #FFD700;">🧪 Test Notification</h1>
          <p>This is a test notification from Washero admin panel.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <p style="color: #888;">If you received this, email notifications are working!</p>
        </body>
        </html>
      `;
      const testWhatsAppMessage = `🧪 *Test Notification - Washero*\n\nThis is a test from admin panel.\n\nTimestamp: ${new Date().toLocaleString('es-AR')}`;

      let emailResult: { success: boolean; id?: string; error?: string } = { success: false, error: "RESEND_API_KEY not configured" };
      let whatsappResult: { success: boolean; sid?: string; error?: string } = { success: false, error: "Twilio not configured" };

      // Send test email
      if (resendApiKey) {
        emailResult = await sendEmail(resendApiKey, ADMIN_EMAIL, testSubject, testHtml);
        console.log("[send-notifications] Test email result:", emailResult);

        // Log to notification_logs
        await supabase.from("notification_logs").insert({
          notification_type: "email",
          status: emailResult.success ? "sent" : "failed",
          recipient: ADMIN_EMAIL,
          message_content: "Test notification",
          error_message: emailResult.error || null,
          external_id: emailResult.id || null,
        });
      }

      // Send test WhatsApp
      if (twilioAccountSid && twilioAuthToken && twilioWhatsAppNumber) {
        whatsappResult = await sendWhatsApp(
          twilioAccountSid,
          twilioAuthToken,
          twilioWhatsAppNumber,
          ADMIN_WHATSAPP,
          testWhatsAppMessage
        );
        console.log("[send-notifications] Test WhatsApp result:", whatsappResult);

        // Log to notification_logs
        await supabase.from("notification_logs").insert({
          notification_type: "whatsapp",
          status: whatsappResult.success ? "sent" : "failed",
          recipient: ADMIN_WHATSAPP,
          message_content: "Test notification",
          error_message: whatsappResult.error || null,
          external_id: whatsappResult.sid || null,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          email: emailResult,
          whatsapp: whatsappResult,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If bookingId provided, process that specific booking
    if (bookingId) {
      // Trigger process-notifications for specific booking
      const { data, error } = await supabase.functions.invoke("process-notifications", {
        body: { bookingId }
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, result: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: trigger process-notifications for all pending
    const { data, error } = await supabase.functions.invoke("process-notifications");

    if (error) {
      console.error("[send-notifications] Error invoking process-notifications:", error);
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, result: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-notifications] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
