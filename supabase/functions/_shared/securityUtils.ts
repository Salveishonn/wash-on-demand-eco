import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Log an error to app_error_logs table
 */
export async function logError(
  source: string,
  errorType: string,
  message: string,
  details: Record<string, unknown> = {},
  req?: Request
) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const requestIp = req?.headers.get("x-forwarded-for") ||
      req?.headers.get("cf-connecting-ip") ||
      req?.headers.get("x-real-ip") || null;

    const userAgent = req?.headers.get("user-agent") || null;

    await supabase.from("app_error_logs").insert({
      source,
      error_type: errorType,
      message,
      details,
      request_ip: requestIp,
      user_agent: userAgent,
    });
  } catch (e) {
    console.error("[securityUtils] Failed to log error:", e);
  }
}

/**
 * Simple IP-based rate limiting using rate_limits table
 * Returns true if rate limit exceeded
 */
export async function isRateLimited(
  key: string,
  maxRequests: number,
  windowMinutes: number,
  req?: Request
): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip = req?.headers.get("x-forwarded-for") ||
      req?.headers.get("cf-connecting-ip") ||
      req?.headers.get("x-real-ip") || "unknown";

    const rateLimitKey = `${key}:${ip}`;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    // Try to get existing rate limit entry
    const { data: existing } = await supabase
      .from("rate_limits")
      .select("*")
      .eq("key", rateLimitKey)
      .single();

    if (existing) {
      // Check if window has expired
      if (new Date(existing.window_start) < new Date(windowStart)) {
        // Reset window
        await supabase
          .from("rate_limits")
          .update({ count: 1, window_start: new Date().toISOString() })
          .eq("key", rateLimitKey);
        return false;
      }

      // Increment
      if (existing.count >= maxRequests) {
        return true; // Rate limited
      }

      await supabase
        .from("rate_limits")
        .update({ count: existing.count + 1 })
        .eq("key", rateLimitKey);
      return false;
    }

    // Create new entry
    await supabase.from("rate_limits").insert({
      key: rateLimitKey,
      window_start: new Date().toISOString(),
      count: 1,
    });

    return false;
  } catch (e) {
    console.error("[securityUtils] Rate limit check failed:", e);
    return false; // Fail open
  }
}

/**
 * Validate honeypot field - if filled, it's a bot
 */
export function isHoneypotTriggered(value?: string): boolean {
  return !!value && value.trim().length > 0;
}

/**
 * Check submission timing - if too fast (< 2 seconds), likely a bot
 */
export function isTooFastSubmission(submittedAt?: number): boolean {
  if (!submittedAt) return false;
  const elapsed = Date.now() - submittedAt;
  return elapsed < 2000; // Less than 2 seconds
}

/**
 * Log a login attempt
 */
export async function logLoginAttempt(
  email: string,
  success: boolean,
  req?: Request
) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ipAddress = req?.headers.get("x-forwarded-for") ||
      req?.headers.get("cf-connecting-ip") ||
      req?.headers.get("x-real-ip") || null;

    const userAgent = req?.headers.get("user-agent") || null;

    await supabase.from("login_attempts").insert({
      email,
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
    });
  } catch (e) {
    console.error("[securityUtils] Failed to log login attempt:", e);
  }
}

/**
 * Check if an email has too many failed login attempts (brute force protection)
 * Returns true if blocked
 */
export async function isLoginBlocked(email: string): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .eq("success", false)
      .gte("created_at", fifteenMinAgo);

    return (count || 0) >= 5; // Block after 5 failed attempts in 15 min
  } catch (e) {
    console.error("[securityUtils] Failed to check login block:", e);
    return false;
  }
}
