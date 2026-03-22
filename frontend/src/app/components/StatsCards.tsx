/**
 * StatsCards.tsx
 * Three stat cards: HIGH / MED / LOW alert counts.
 * Reads directly from alertsStore — zero props needed.
 */

import { useAlertsStore } from "../store/alertsStore";

interface CardProps {
  label: string;
  count: number;
  colorClass: string;
  icon: string;
}

function StatCard({ label, count, colorClass, icon }: CardProps) {
  return (
    <div
      className={`rounded-xl border bg-slate-900/60 p-5 flex items-center gap-4 ${colorClass}`}
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-3xl font-bold tabular-nums">{count}</p>
      </div>
    </div>
  );
}

export function StatsCards() {
  const high = useAlertsStore((s) => s.highCount());
  const med  = useAlertsStore((s) => s.mediumCount());
  const low  = useAlertsStore((s) => s.lowCount());
  const total = useAlertsStore((s) => s.alerts.length);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard label="Total"    count={total} colorClass="border-white/10 text-slate-200"  icon="📡" />
      <StatCard label="High"     count={high}  colorClass="border-red-500/30 text-red-400"  icon="🔴" />
      <StatCard label="Medium"   count={med}   colorClass="border-yellow-500/30 text-yellow-400" icon="🟡" />
      <StatCard label="Low"      count={low}   colorClass="border-blue-500/30 text-blue-400" icon="🔵" />
    </div>
  );
}