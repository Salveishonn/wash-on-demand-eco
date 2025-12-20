import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BootstrapRequest {
  email: string;
  password: string;
  bootstrapSecret: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const expectedSecret = Deno.env.get("BOOTSTRAP_SECRET");

  if (!expectedSecret) {
    console.error("[bootstrap-admin] BOOTSTRAP_SECRET not configured");
    return new Response(
      JSON.stringify({ error: "Bootstrap not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { email, password, bootstrapSecret }: BootstrapRequest = await req.json();
    
    console.log("[bootstrap-admin] Attempting to create admin:", email);

    // Validate bootstrap secret
    if (bootstrapSecret !== expectedSecret) {
      console.warn("[bootstrap-admin] Invalid bootstrap secret");
      return new Response(
        JSON.stringify({ error: "Invalid bootstrap secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if any admin already exists
    const { data: existingAdmins, error: checkError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (checkError) {
      console.error("[bootstrap-admin] Check error:", checkError);
      throw checkError;
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log("[bootstrap-admin] Admin already exists");
      return new Response(
        JSON.stringify({ error: "An admin already exists. Use the admin panel to create more." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user with admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        full_name: "Admin",
        role: "admin",
      },
    });

    if (authError) {
      console.error("[bootstrap-admin] Auth error:", authError);
      
      // If user already exists, try to find and assign admin role
      if (authError.message.includes("already been registered")) {
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const user = existingUser?.users?.find(u => u.email === email);
        
        if (user) {
          // Assign admin role
          const { error: roleError } = await supabase
            .from("user_roles")
            .upsert({
              user_id: user.id,
              role: "admin",
            }, {
              onConflict: "user_id,role",
            });

          if (roleError) {
            throw roleError;
          }

          console.log("[bootstrap-admin] Admin role assigned to existing user:", email);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Admin role assigned to existing user",
              userId: user.id 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      throw authError;
    }

    const userId = authData.user.id;
    console.log("[bootstrap-admin] User created:", userId);

    // Assign admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "admin",
      });

    if (roleError) {
      console.error("[bootstrap-admin] Role assignment error:", roleError);
      // Try to clean up user if role assignment fails
      await supabase.auth.admin.deleteUser(userId);
      throw roleError;
    }

    console.log("[bootstrap-admin] ✅ Admin created successfully:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin created successfully",
        userId,
        email 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[bootstrap-admin] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
