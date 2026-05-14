import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";

const BOTMAKER_CHANNEL_ID = "O0FW1NYUKE";
const BOTMAKER_SCRIPT_SRC = `https://go.botmaker.com/rest/webchat/p/${BOTMAKER_CHANNEL_ID}/init.js`;
const WHATSAPP_FALLBACK_URL = "https://wa.me/5491176247835?text=" + encodeURIComponent("Hola Washero! Quiero hacer una consulta.");
const LOAD_TIMEOUT_MS = 6000;

const EXCLUDED_PREFIXES = [
  "/admin",
  "/ops",
  "/driver",
  "/login",
  "/auth",
  "/payment",
  "/mercadopago",
  "/pago",
  "/pagar",
];

export interface BotmakerDiagnostics {
  scriptInjected: boolean;
  scriptLoaded: boolean;
  scriptError: boolean;
  bmInfoAvailable: boolean;
  bmShowAvailable: boolean;
  routeExcluded: boolean;
  fallbackActive: boolean;
  lastChecked: number;
}

function readDiagnostics(routeExcluded: boolean): BotmakerDiagnostics {
  const w = window as any;
  const scriptEl = document.querySelector(`script[src="${BOTMAKER_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
  return {
    scriptInjected: Boolean(scriptEl),
    scriptLoaded: Boolean(scriptEl?.dataset.bmLoaded === "1"),
    scriptError: Boolean(scriptEl?.dataset.bmError === "1"),
    bmInfoAvailable: typeof w.bmInfo !== "undefined",
    bmShowAvailable: typeof w.bmShow === "function",
    routeExcluded,
    fallbackActive: Boolean(w.__washeroBmFallbackActive),
    lastChecked: Date.now(),
  };
}

// Globally exposed for the Admin diagnostics panel
function publishDiagnostics(d: BotmakerDiagnostics) {
  (window as any).__washeroBotmakerDiagnostics = d;
}

export const BotmakerWebchat = () => {
  const { pathname } = useLocation();
  const injectedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  const isExcluded = EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isExcluded) {
      setShowFallback(false);
      (window as any).__washeroBmFallbackActive = false;
      publishDiagnostics(readDiagnostics(true));
      return;
    }

    let timeoutId: number | undefined;

    const ensureScript = () => {
      let scriptEl = document.querySelector(`script[src="${BOTMAKER_SCRIPT_SRC}"]`) as HTMLScriptElement | null;

      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.type = "text/javascript";
        scriptEl.async = true;
        scriptEl.src = BOTMAKER_SCRIPT_SRC;
        scriptEl.onload = () => {
          scriptEl!.dataset.bmLoaded = "1";
          publishDiagnostics(readDiagnostics(false));
        };
        scriptEl.onerror = () => {
          scriptEl!.dataset.bmError = "1";
          setShowFallback(true);
          (window as any).__washeroBmFallbackActive = true;
          publishDiagnostics(readDiagnostics(false));
        };
        document.body.appendChild(scriptEl);
      }
      injectedRef.current = true;

      // Fallback timer: if nothing visible after N ms, show floating CTA
      timeoutId = window.setTimeout(() => {
        const w = window as any;
        const widgetExists = document.querySelector(
          '[id*="botmaker"], [class*="botmaker"], iframe[src*="botmaker"]'
        );
        if (!widgetExists && typeof w.bmInfo === "undefined") {
          setShowFallback(true);
          (window as any).__washeroBmFallbackActive = true;
        }
        publishDiagnostics(readDiagnostics(false));
      }, LOAD_TIMEOUT_MS);
    };

    ensureScript();
    publishDiagnostics(readDiagnostics(false));

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isExcluded, pathname]);

  if (isExcluded || !showFallback) return null;

  // Fallback floating CTA — placed bottom-left so the booking "Reservar"
  // CTA (typically bottom-right on mobile) is not covered.
  return (
    <a
      href={WHATSAPP_FALLBACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatear con Washero por WhatsApp"
      className="fixed left-4 bottom-4 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-transform text-sm font-semibold"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <MessageCircle className="w-4 h-4" />
      Chatear con Washero
    </a>
  );
};
