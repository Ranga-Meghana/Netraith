/**
 * AlertsTable.tsx
 * Live-updating table of Suricata alerts.
 */

import { useAlertsStore } from "../store/alertsStore";
import type { Alert } from "../hooks/useSocket";

const SEVERITY_LABEL: Record<string, string> = {
  critical: "CRITICAL",
  high:     "HIGH",
  medium:   "MED",
  low:      "LOW",
};

const SEVERITY_CLASS: Record<string, string> = {
  critical: "bg-red-600/20 text-red-400 ring-1 ring-red-600/40",
  high:     "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40",
  medium:   "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40",
  low:      "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40",
};

function SeverityBadge({ level }: { level: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold tracking-wider ${SEVERITY_CLASS[level] ?? SEVERITY_CLASS["medium"]}`}
    >
      {SEVERITY_LABEL[level] ?? "MED"}
    </span>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const time = new Date(alert.timestamp).toLocaleTimeString();
  return (
    <tr className="border-b border-white/5 transition-colors hover:bg-white/5">
      <td className="px-4 py-2 text-xs text-slate-400 font-mono">{time}</td>
      <td className="px-4 py-2">
        <SeverityBadge level={alert.severity} />
      </td>
      <td className="px-4 py-2 text-sm text-slate-200 max-w-xs truncate">
        {alert.signature}
      </td>
      <td className="px-4 py-2 text-xs text-slate-400 font-mono">{alert.srcIp}</td>
      <td className="px-4 py-2 text-xs text-slate-400 font-mono">{alert.destIp}</td>
      <td className="px-4 py-2 text-xs text-slate-500">{alert.proto}</td>
      <td className="px-4 py-2 text-xs text-slate-500 truncate max-w-[160px]">
        {alert.category}
      </td>
    </tr>
  );
}

export function AlertsTable() {
  const alerts      = useAlertsStore((s) => s.alerts);
  const clearAlerts = useAlertsStore((s) => s.clearAlerts);

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
        <span className="text-4xl">🛡️</span>
        <p className="text-sm">No alerts yet — system is monitoring…</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-slate-300">
          Live Alerts{" "}
          <span className="ml-1 rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
            {alerts.length}
          </span>
        </span>
        <button
          onClick={clearAlerts}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-slate-500 uppercase tracking-wider">
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Sev</th>
            <th className="px-4 py-3">Signature</th>
            <th className="px-4 py-3">Src IP</th>
            <th className="px-4 py-3">Dest IP</th>
            <th className="px-4 py-3">Proto</th>
            <th className="px-4 py-3">Category</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </tbody>
      </table>
    </div>
  );
}