import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const BOTMAKER_SCRIPT_SRC = "https://go.botmaker.com/rest/webchat/p/O0FW1NYUKE/init.js";

const EXCLUDED_PREFIXES = [
  "/admin",
  "/ops",
  "/driver",
  "/login",
  "/auth",
  "/payment",
  "/mercadopago",
];

export const BotmakerWebchat = () => {
  const { pathname } = useLocation();
  const injectedRef = useRef(false);

  useEffect(() => {
    const isExcluded = EXCLUDED_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );

    if (isExcluded) {
      // If we navigated to an excluded route, remove the script and widget if present
      const existingScript = document.querySelector(
        `script[src="${BOTMAKER_SCRIPT_SRC}"]`
      );
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
      // Botmaker may inject a container; attempt to remove it on exclusion
      const bmContainers = document.querySelectorAll(
        '[id*="botmaker"], [class*="botmaker"]'
      );
      bmContainers.forEach((el) => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      injectedRef.current = false;
      return;
    }

    // Public route: inject if not already present
    if (injectedRef.current) return;
    const alreadyInDom = document.querySelector(
      `script[src="${BOTMAKER_SCRIPT_SRC}"]`
    );
    if (alreadyInDom) {
      injectedRef.current = true;
      return;
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = BOTMAKER_SCRIPT_SRC;
    document.body.appendChild(script);
    injectedRef.current = true;

    // No explicit cleanup needed on unmount for public routes;
    // the script should persist across public route navigations.
  }, [pathname]);

  return null;
};
