import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  name: string;
  phone: string;
  email?: string;
  address: string;
  planCode: string;
  washesPerMonth: number;
  priceArs: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateSubscriptionRequest = await req.json();
    const { name, phone, email, address, planCode, washesPerMonth, priceArs } = body;

    console.log("[create-user-subscription] Request:", { name, phone, planCode });

    // Validate required fields
    if (!name || !phone || !address || !planCode || !washesPerMonth || !priceArs) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert user by phone
    const { data: existingUser, error: userQueryError } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (userQueryError) {
      console.error("[create-user-subscription] User query error:", userQueryError);
      throw userQueryError;
    }

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update user info
      await supabase
        .from("users")
        .update({ name, email, updated_at: new Date().toISOString() })
        .eq("id", userId);
      console.log("[create-user-subscription] Updated existing user:", userId);
    } else {
      // Create new user
      const { data: newUser, error: createUserError } = await supabase
        .from("users")
        .insert({ phone, name, email })
        .select("id")
        .single();

      if (createUserError) {
        console.error("[create-user-subscription] Create user error:", createUserError);
        throw createUserError;
      }
      userId = newUser.id;
      console.log("[create-user-subscription] Created new user:", userId);
    }

    // Check for existing active subscription
    const { data: existingSub } = await supabase
      .from("user_subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["active", "pending"])
      .maybeSingle();

    if (existingSub) {
      console.log("[create-user-subscription] User already has active subscription:", existingSub.id);
      return new Response(
        JSON.stringify({
          success: true,
          subscriptionId: existingSub.id,
          message: "Ya tenés una suscripción activa",
          existing: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate next billing date (1 month from now)
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    // Create subscription
    const { data: subscription, error: subError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        plan_code: planCode,
        washes_per_month: washesPerMonth,
        price_ars: priceArs,
        status: "pending", // Will be activated after payment
        next_billing_date: nextBillingDate.toISOString().split("T")[0],
        payment_provider: "mercadopago",
      })
      .select("id")
      .single();

    if (subError) {
      console.error("[create-user-subscription] Create subscription error:", subError);
      throw subError;
    }

    console.log("[create-user-subscription] Created subscription:", subscription.id);

    // Store address in a booking as first booking placeholder
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 3); // 3 days from now as placeholder

    await supabase.from("user_bookings").insert({
      user_id: userId,
      subscription_id: subscription.id,
      service_code: "FULL",
      scheduled_at: scheduledAt.toISOString(),
      address_text: address,
      status: "pending",
    });

    // Send WhatsApp notification (template - outside 24h window)
    const metaToken = Deno.env.get("META_WA_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("META_WA_PHONE_NUMBER_ID");

    if (metaToken && phoneNumberId) {
      const recipientPhone = phone.replace(/^\+/, "");
      
      try {
        const waResponse = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${metaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: recipientPhone,
              type: "template",
              template: {
                name: "washero_booking_confirmed",
                language: { code: "es_AR" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: name },
                      { type: "text", text: `Plan ${planCode}` },
                      { type: "text", text: address },
                    ],
                  },
                ],
              },
            }),
          }
        );

        const waResult = await waResponse.json();
        console.log("[create-user-subscription] WhatsApp send result:", waResult);

        // Log the message
        const { error: logError } = await supabase.from("whatsapp_messages").insert({
          conversation_id: null,
          direction: "outbound",
          body: `Plan subscription confirmation: ${planCode}`,
          status: waResponse.ok ? "sent" : "failed",
          error: waResponse.ok ? null : JSON.stringify(waResult),
        });
        
        if (logError) {
          console.error("Failed to log WhatsApp message:", logError);
        }

      } catch (waError) {
        console.error("[create-user-subscription] WhatsApp error:", waError);
        // Don't fail the subscription for WhatsApp errors
      }
    } else {
      console.log("[create-user-subscription] WhatsApp not configured, skipping notification");
    }

    // Queue admin notification
    try {
      await supabase.functions.invoke("queue-notifications", {
        body: {
          type: "new_subscription",
          subscriptionId: subscription.id,
          customerName: name,
          customerPhone: phone,
          planCode,
          priceArs,
        },
      });
    } catch (notifError) {
      console.error("[create-user-subscription] Notification queue error:", notifError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscription.id,
        userId,
        message: "Subscription created successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[create-user-subscription] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
