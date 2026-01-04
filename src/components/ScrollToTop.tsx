import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop component - Scrolls to top on route changes
 * Respects browser back/forward navigation (doesn't force scroll)
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
