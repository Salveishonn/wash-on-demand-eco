import { useEffect, useState } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq_debug_events?: { event: string; ts: number }[];
  }
}

const PIXEL_ID = "912953068289942";

const DebugPixel = () => {
  const [events, setEvents] = useState<{ event: string; ts: number }[]>([]);
  const [hasFbq, setHasFbq] = useState(false);

  useEffect(() => {
    setHasFbq(typeof window.fbq === "function");

    // Patch fbq to capture events for debug display
    if (!window._fbq_debug_events) {
      window._fbq_debug_events = [];
      const original = window.fbq;
      if (original) {
        window.fbq = ((...args: unknown[]) => {
          if (args[0] === "track") {
            const entry = { event: String(args[1]), ts: Date.now() };
            window._fbq_debug_events!.push(entry);
          }
          return (original as Function).apply(null, args);
        }) as typeof window.fbq;
        // Preserve properties
        Object.assign(window.fbq, original);
      }
    }

    const interval = setInterval(() => {
      setEvents([...(window._fbq_debug_events ?? [])]);
      setHasFbq(typeof window.fbq === "function");
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-8 font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">🔍 Meta Pixel Debug</h1>
      <table className="border-collapse">
        <tbody>
          <tr><td className="pr-4 font-bold">Hostname</td><td>{window.location.hostname}</td></tr>
          <tr><td className="pr-4 font-bold">window.fbq exists</td><td>{hasFbq ? "✅ true" : "❌ false"}</td></tr>
          <tr><td className="pr-4 font-bold">Pixel ID</td><td>{PIXEL_ID}</td></tr>
        </tbody>
      </table>
      <h2 className="text-lg font-bold mt-6 mb-2">Fired Events ({events.length})</h2>
      <button
        className="mb-4 px-4 py-2 bg-primary text-primary-foreground rounded font-bold"
        onClick={() => {
          window.fbq?.("trackCustom", "TestEvent", { test: true });
          window._fbq_debug_events?.push({ event: "TestEvent (custom)", ts: Date.now() });
          setEvents([...(window._fbq_debug_events ?? [])]);
        }}
      >
        🧪 Fire TestEvent
      </button>
      {events.length === 0 ? (
        <p className="text-muted-foreground">No events captured yet (navigate to another page and come back).</p>
      ) : (
        <ul className="space-y-1">
          {events.map((e, i) => (
            <li key={i}>{new Date(e.ts).toLocaleTimeString()} — {e.event}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DebugPixel;
