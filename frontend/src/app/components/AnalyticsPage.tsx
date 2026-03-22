import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAlertsStore } from '../store/alertsStore';
import { ThreatForecast } from './ThreatForecast';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const font     = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';
const CYAN     = '#00FFD4';
const RED      = '#FF3A3A';
const ORANGE   = '#FF6B00';
const TEAL     = '#00D4C8';
const DIM      = 'rgba(0,220,200,0.55)';

const SEV_COLORS: Record<string, string> = {
  critical: RED,
  high:     ORANGE,
  medium:   '#FFD700',
  low:      CYAN,
};

function GlassCard({ children, title, style }: { children: React.ReactNode; title: string; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'rgba(0,12,25,0.75)', border: '1px solid rgba(0,200,180,0.18)', backdropFilter: 'blur(12px)', borderRadius: 2, padding: '14px 16px', ...style }}>
      <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 14, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(0,8,18,0.95)', border: '1px solid rgba(0,200,180,0.3)', padding: '8px 12px', fontFamily: monoFont, fontSize: 9 }}>
      <div style={{ color: CYAN, marginBottom: 4, letterSpacing: '0.1em' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, letterSpacing: '0.1em' }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

export function AnalyticsPage() {
  const liveAlerts = useAlertsStore((s) => s.alerts);
  const [tab, setTab] = useState<'analytics' | 'forecast'>('analytics');

  // Severity distribution for pie chart
  const severityData = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    liveAlerts.forEach(a => { counts[a.severity as keyof typeof counts] = (counts[a.severity as keyof typeof counts] || 0) + 1; });
    return Object.entries(counts).filter(([,v]) => v > 0).map(([name, value]) => ({ name: name.toUpperCase(), value, color: SEV_COLORS[name] }));
  }, [liveAlerts]);

  // Alerts over time (group by minute)
  const timelineData = useMemo(() => {
    if (liveAlerts.length === 0) return [];
    const buckets: Record<string, { time: string; critical: number; high: number; medium: number; total: number }> = {};
    liveAlerts.forEach(a => {
      const t = new Date(a.timestamp);
      const key = `${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;
      if (!buckets[key]) buckets[key] = { time: key, critical: 0, high: 0, medium: 0, total: 0 };
      buckets[key].total++;
      if (a.severity === 'critical') buckets[key].critical++;
      else if (a.severity === 'high') buckets[key].high++;
      else buckets[key].medium++;
    });
    return Object.values(buckets).slice(-15);
  }, [liveAlerts]);

  // Top attack types
  const attackTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    liveAlerts.forEach(a => {
      const key = a.category || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 20 ? name.substring(0, 20) + '…' : name, count }));
  }, [liveAlerts]);

  // Top source IPs
  const topIPs = useMemo(() => {
    const counts: Record<string, { count: number; severity: string }> = {};
    liveAlerts.forEach(a => {
      if (!counts[a.srcIp]) counts[a.srcIp] = { count: 0, severity: a.severity };
      counts[a.srcIp].count++;
      if (a.severity === 'critical') counts[a.srcIp].severity = 'critical';
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([ip, { count, severity }]) => ({ ip, count, severity, pct: Math.round((count / liveAlerts.length) * 100) }));
  }, [liveAlerts]);

  // Proto distribution
  const protoData = useMemo(() => {
    const counts: Record<string, number> = {};
    liveAlerts.forEach(a => { counts[a.proto] = (counts[a.proto] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [liveAlerts]);

  // Summary stats
  const total    = liveAlerts.length;
  const critical = liveAlerts.filter(a => a.severity === 'critical').length;
  const uniqueIPs = new Set(liveAlerts.map(a => a.srcIp)).size;
  const critPct  = total > 0 ? Math.round((critical / total) * 100) : 0;

  const axisStyle = { fontFamily: monoFont, fontSize: 8, fill: 'rgba(150,200,200,0.5)' };

  if (total === 0 && tab === 'analytics') {
    return (
      <div style={{ width: '100%', height: '100%', background: '#000814', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(0,200,180,0.1)', display: 'flex', gap: 6, flexShrink: 0 }}>
          {(['analytics', 'forecast'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 16px', background: tab === t ? 'rgba(0,255,212,0.08)' : 'transparent', border: `1px solid ${tab === t ? 'rgba(0,255,212,0.35)' : 'transparent'}`, color: tab === t ? CYAN : 'rgba(150,200,200,0.5)', fontFamily: monoFont, fontSize: 9, letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 1, textTransform: 'uppercase' }}>
              {t === 'forecast' ? '🔮 FORECAST' : '📊 ANALYTICS'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <span style={{ fontSize: 48 }}>📊</span>
          <span style={{ fontSize: 12, color: CYAN, letterSpacing: '0.3em', fontFamily: font }}>ANALYTICS</span>
          <span style={{ fontSize: 9, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.2em', fontFamily: monoFont }}>NO DATA YET — SIMULATE ATTACKS TO SEE CHARTS</span>
        </div>
      </div>
    );
  }

  if (tab === 'forecast') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(0,200,180,0.1)', display: 'flex', gap: 6, flexShrink: 0, background: '#000814' }}>
          {(['analytics', 'forecast'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 16px', background: tab === t ? 'rgba(0,255,212,0.08)' : 'transparent', border: `1px solid ${tab === t ? 'rgba(0,255,212,0.35)' : 'transparent'}`, color: tab === t ? CYAN : 'rgba(150,200,200,0.5)', fontFamily: monoFont, fontSize: 9, letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 1, textTransform: 'uppercase' }}>
              {t === 'forecast' ? '🔮 FORECAST' : '📊 ANALYTICS'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}><ThreatForecast /></div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#000814', overflow: 'auto', padding: 16, fontFamily: monoFont }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, position: 'relative', zIndex: 1 }}>
        {(['analytics', 'forecast'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 16px', background: tab === t ? 'rgba(0,255,212,0.08)' : 'transparent', border: `1px solid ${tab === t ? 'rgba(0,255,212,0.35)' : 'rgba(0,200,180,0.15)'}`, color: tab === t ? CYAN : 'rgba(150,200,200,0.5)', fontFamily: monoFont, fontSize: 9, letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 1, textTransform: 'uppercase' }}>
            {t === 'forecast' ? '🔮 FORECAST' : '📊 ANALYTICS'}
          </button>
        ))}
      </div>
      {/* Scan lines */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,180,0.005) 3px, rgba(0,255,180,0.005) 4px)' }} />

      {/* Page title */}
      <div style={{ marginBottom: 16, zIndex: 1, position: 'relative' }}>
        <div style={{ fontFamily: font, fontSize: 13, color: CYAN, letterSpacing: '0.35em', textShadow: `0 0 10px ${CYAN}` }}>THREAT ANALYTICS</div>
        <div style={{ fontFamily: monoFont, fontSize: 9, color: DIM, letterSpacing: '0.2em', marginTop: 2 }}>REAL-TIME STATISTICAL ANALYSIS — {total} ALERTS PROCESSED</div>
      </div>

      {/* Summary KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14, zIndex: 1, position: 'relative' }}>
        {[
          { label: 'TOTAL ALERTS',   value: total,      color: CYAN,   icon: '📡' },
          { label: 'CRITICAL',       value: critical,   color: RED,    icon: '🔴' },
          { label: 'UNIQUE SOURCES', value: uniqueIPs,  color: ORANGE, icon: '🌐' },
          { label: 'CRITICAL RATE',  value: `${critPct}%`, color: critPct > 50 ? RED : ORANGE, icon: '⚠️' },
        ].map(k => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'rgba(0,12,25,0.75)', border: `1px solid ${k.color}30`, backdropFilter: 'blur(12px)', borderRadius: 2, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>{k.icon}</span>
            <div>
              <div style={{ fontFamily: font, fontSize: 20, fontWeight: 900, color: k.color, textShadow: `0 0 10px ${k.color}`, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.5)', letterSpacing: '0.15em', marginTop: 3 }}>{k.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, zIndex: 1, position: 'relative' }}>

        {/* Timeline chart */}
        <GlassCard title="ALERTS OVER TIME" style={{ gridColumn: '1 / -1' }}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="gcrit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={RED}    stopOpacity={0.3} />
                  <stop offset="95%" stopColor={RED}    stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="ghigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ORANGE} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ORANGE} stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gmed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FFD700" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,180,0.08)" />
              <XAxis dataKey="time" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontFamily: monoFont, fontSize: 9 }} />
              <Area type="monotone" dataKey="critical" stroke={RED}     strokeWidth={1.5} fill="url(#gcrit)" name="CRITICAL" />
              <Area type="monotone" dataKey="high"     stroke={ORANGE}  strokeWidth={1.5} fill="url(#ghigh)" name="HIGH"     />
              <Area type="monotone" dataKey="medium"   stroke="#FFD700" strokeWidth={1.5} fill="url(#gmed)"  name="MEDIUM"   />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Attack types bar chart */}
        <GlassCard title="TOP ATTACK CATEGORIES">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attackTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,180,0.08)" horizontal={false} />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 7 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="COUNT" radius={[0, 2, 2, 0]}>
                {attackTypeData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? RED : i === 1 ? ORANGE : i < 4 ? '#FFD700' : CYAN} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Severity pie */}
        <GlassCard title="SEVERITY DISTRIBUTION">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={severityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={3}>
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.85} stroke={entry.color} strokeWidth={1} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontFamily: monoFont, fontSize: 9 }} />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Protocol + Top IPs */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, zIndex: 1, position: 'relative' }}>
        <GlassCard title="PROTOCOL BREAKDOWN">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={protoData} cx="50%" cy="50%" outerRadius={60} dataKey="value" nameKey="name" paddingAngle={2}>
                {protoData.map((_, i) => (
                  <Cell key={i} fill={[CYAN, ORANGE, RED, TEAL, '#FFD700'][i % 5]} fillOpacity={0.8} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontFamily: monoFont, fontSize: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard title="TOP ATTACK SOURCES">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topIPs.map((ip, i) => {
              const col = SEV_COLORS[ip.severity] || CYAN;
              return (
                <div key={ip.ip} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.35)', width: 16, textAlign: 'right' }}>#{i+1}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: col, textShadow: `0 0 6px ${col}`, width: 120 }}>{ip.ip}</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(0,200,180,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${ip.pct}%` }} transition={{ duration: 1, delay: i * 0.1 }}
                      style={{ height: '100%', background: col, boxShadow: `0 0 6px ${col}`, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: monoFont, fontSize: 8, color: col, width: 30, textAlign: 'right' }}>{ip.count}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.3)', width: 30 }}>{ip.pct}%</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}