import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Fires Meta Pixel PageView on every SPA route change.
 * The initial PageView is already fired by the inline script in index.html,
 * so we skip the first render and only fire on subsequent navigations.
 */
export const MetaPixelPageView = () => {
  const location = useLocation();
  const lastPathname = useRef(location.pathname);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render — the inline script already fired PageView
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (import.meta.env.DEV) {
        console.log("[Meta Pixel] loaded", !!window.fbq);
        console.log("[Meta Pixel] initial PageView (from inline script)", location.pathname);
      }
      return;
    }

    // Only fire if the pathname actually changed (avoid double-fire)
    if (location.pathname !== lastPathname.current) {
      lastPathname.current = location.pathname;
      window.fbq?.("track", "PageView");
      if (import.meta.env.DEV) {
        console.log("[Meta Pixel] PageView fired", location.pathname);
      }
    }
  }, [location.pathname]);

  return null;
};
