import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

export function useSessionTimeout(enabled: boolean = false) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      console.log("[SessionTimeout] Logging out due to inactivity");
      await supabase.auth.signOut();
      window.location.href = "/admin/login";
    }, TIMEOUT_MS);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, resetTimer]);
}
