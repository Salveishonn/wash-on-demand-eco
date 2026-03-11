/**
 * Hook to track form render timestamp for anti-bot timing checks.
 * Returns timestamp that should be sent as `_ts` in form submissions.
 */
import { useRef } from "react";

export function useFormTimestamp(): number {
  const ts = useRef(Date.now());
  return ts.current;
}
