/**
 * ConnectionStatus.tsx
 * Small pill that shows live / connecting / error status.
 * Drop this anywhere in your layout (navbar, sidebar header, etc.)
 */

import { useAlertsStore } from "../store/alertsStore";

export function ConnectionStatus() {
  const connected = useAlertsStore((s) => s.connected);
  const error = useAlertsStore((s) => s.connectionError);

  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        LIVE
      </span>
    );
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400 ring-1 ring-red-500/30">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        ERROR — {error}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400 ring-1 ring-yellow-500/30">
      <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
      CONNECTING…
    </span>
  );
}