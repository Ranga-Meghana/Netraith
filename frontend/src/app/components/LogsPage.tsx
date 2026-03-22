import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlertsStore } from '../store/alertsStore';

const font     = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';
const CYAN     = '#00FFD4';
const RED      = '#FF3A3A';
const ORANGE   = '#FF6B00';
const DIM      = 'rgba(0,220,200,0.55)';

const SEV_COLOR: Record<string, string> = {
  critical: RED,
  high:     ORANGE,
  medium:   '#FFD700',
  low:      CYAN,
};

const SEV_BG: Record<string, string> = {
  critical: 'rgba(255,58,58,0.08)',
  high:     'rgba(255,107,0,0.08)',
  medium:   'rgba(255,215,0,0.06)',
  low:      'rgba(0,255,212,0.05)',
};

export function LogsPage() {
  const liveAlerts  = useAlertsStore((s) => s.alerts);
  const clearAlerts = useAlertsStore((s) => s.clearAlerts);

  const [filter,  setFilter]  = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [search,  setSearch]  = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const filtered = useMemo(() => {
    let list = [...liveAlerts];
    if (filter !== 'ALL') list = list.filter(a => a.severity === filter.toLowerCase());
    if (search.trim())    list = list.filter(a =>
      a.srcIp.includes(search)     ||
      a.signature.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase())
    );
    if (sortDir === 'asc') list.reverse();
    return list;
  }, [liveAlerts, filter, search, sortDir]);

  const counts = useMemo(() => ({
    critical: liveAlerts.filter(a => a.severity === 'critical').length,
    high:     liveAlerts.filter(a => a.severity === 'high').length,
    medium:   liveAlerts.filter(a => a.severity === 'medium').length,
    low:      liveAlerts.filter(a => a.severity === 'low').length,
  }), [liveAlerts]);

  function exportJSON() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `netraith-logs-${Date.now()}.json`;
    a.click();
  }

  function exportCSV() {
    const header = 'id,timestamp,severity,src_ip,dest_ip,src_port,dest_port,proto,signature,category\n';
    const rows   = filtered.map(a =>
      `${a.id},${a.timestamp},${a.severity},${a.srcIp},${a.destIp},${a.srcPort},${a.destPort},${a.proto},"${a.signature}","${a.category}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const el   = document.createElement('a');
    el.href     = URL.createObjectURL(blob);
    el.download = `netraith-logs-${Date.now()}.csv`;
    el.click();
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#000814', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: monoFont }}>
      {/* Scan lines */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,180,0.006) 3px, rgba(0,255,180,0.006) 4px)' }} />

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(0,200,180,0.15)', flexShrink: 0, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: font, fontSize: 13, color: CYAN, letterSpacing: '0.35em', textShadow: `0 0 10px ${CYAN}` }}>SURICATA LOGS</div>
            <div style={{ fontFamily: monoFont, fontSize: 9, color: DIM, letterSpacing: '0.2em', marginTop: 2 }}>FULL ALERT LOG — {liveAlerts.length} TOTAL RECORDS</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'EXPORT JSON', action: exportJSON, color: CYAN   },
              { label: 'EXPORT CSV',  action: exportCSV,  color: '#00D4C8' },
              { label: 'CLEAR LOGS', action: clearAlerts, color: RED    },
            { label: '📄 PDF REPORT', action: () => window.open('http://localhost:5000/api/report/generate', '_blank'), color: '#AA88FF' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} style={{ padding: '5px 12px', background: 'rgba(0,12,25,0.8)', border: `1px solid ${btn.color}40`, color: btn.color, fontFamily: monoFont, fontSize: 8, letterSpacing: '0.15em', cursor: 'pointer', borderRadius: 1, transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = `${btn.color}15`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,12,25,0.8)')}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity counters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => {
            const count = sev === 'ALL' ? liveAlerts.length : counts[sev.toLowerCase() as keyof typeof counts];
            const col   = sev === 'ALL' ? CYAN : SEV_COLOR[sev.toLowerCase()];
            const active = filter === sev;
            return (
              <button key={sev} onClick={() => setFilter(sev)} style={{
                padding: '4px 14px', cursor: 'pointer', fontFamily: monoFont, fontSize: 9, letterSpacing: '0.15em',
                background: active ? `${col}18` : 'transparent',
                border: `1px solid ${active ? col : col + '30'}`,
                color: active ? col : col + '80',
                textShadow: active ? `0 0 8px ${col}` : 'none',
                borderRadius: 1, transition: 'all 0.15s',
              }}>
                {sev} <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search + sort */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search IP, signature, category..."
            style={{ flex: 1, padding: '5px 12px', background: 'rgba(0,20,40,0.8)', border: '1px solid rgba(0,200,180,0.2)', color: CYAN, fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em', outline: 'none', borderRadius: 1 }}
          />
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} style={{ padding: '5px 14px', background: 'transparent', border: '1px solid rgba(0,200,180,0.2)', color: DIM, fontFamily: monoFont, fontSize: 9, cursor: 'pointer', borderRadius: 1, letterSpacing: '0.1em' }}>
            {sortDir === 'desc' ? '↓ NEWEST' : '↑ OLDEST'}
          </button>
          <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em' }}>
            {filtered.length} results
          </span>
        </div>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px 140px 70px 120px 120px 60px 60px 1fr 140px', gap: 0, padding: '6px 24px', borderBottom: '1px solid rgba(0,200,180,0.1)', flexShrink: 0, zIndex: 1 }}>
        {['TIME', 'SRC IP', 'PROTO', 'DEST IP', 'SEV', 'S.PORT', 'D.PORT', 'SIGNATURE', 'CATEGORY'].map(h => (
          <div key={h} style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.15em', paddingRight: 8 }}>{h}</div>
        ))}
      </div>

      {/* Log rows */}
      <div style={{ flex: 1, overflowY: 'auto', zIndex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'rgba(150,200,200,0.3)' }}>
            <span style={{ fontSize: 40 }}>🛡️</span>
            <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.2em' }}>NO LOGS FOUND</span>
            <span style={{ fontFamily: monoFont, fontSize: 9, opacity: 0.6 }}>
              {liveAlerts.length === 0 ? 'Waiting for alerts...' : 'No results match your filter'}
            </span>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((alert, idx) => {
              const col  = SEV_COLOR[alert.severity] || CYAN;
              const time = new Date(alert.timestamp).toLocaleTimeString();
              return (
                <motion.div key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 140px 70px 120px 120px 60px 60px 1fr 140px',
                    gap: 0,
                    padding: '7px 24px',
                    borderBottom: '1px solid rgba(0,200,180,0.05)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(0,200,180,0.02)',
                    cursor: 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = SEV_BG[alert.severity] || 'rgba(0,255,212,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(0,200,180,0.02)')}
                >
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.5)', paddingRight: 8 }}>{time}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: col, paddingRight: 8, textShadow: `0 0 6px ${col}` }}>{alert.srcIp}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.5)', paddingRight: 8 }}>{alert.proto}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.5)', paddingRight: 8 }}>{alert.destIp}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: col, fontWeight: 700, letterSpacing: '0.1em', paddingRight: 8, textShadow: `0 0 6px ${col}` }}>{alert.severity.toUpperCase()}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.4)', paddingRight: 8 }}>{alert.srcPort ?? '-'}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.4)', paddingRight: 8 }}>{alert.destPort ?? '-'}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(200,230,230,0.8)', paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.signature}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.category}</span>                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}