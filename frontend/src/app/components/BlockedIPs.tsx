import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const font     = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';
const CYAN     = '#00FFD4';
const RED      = '#FF3A3A';
const ORANGE   = '#FF6B00';
const GREEN    = '#00FF88';
const DIM      = 'rgba(0,220,200,0.55)';

interface BlockedIP {
  ip: string; reason: string; severity: string;
  signature: string; blocked_at: string;
}

interface Props { onClose: () => void; }

export function BlockedIPsPanel({ onClose }: Props) {
  const [blocked, setBlocked]     = useState<BlockedIP[]>([]);
  const [loading, setLoading]     = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [manualIP, setManualIP]   = useState('');
  const [stats, setStats]         = useState({ total_blocked: 0, critical_blocked: 0 });

  async function load() {
    try {
      const [b, s] = await Promise.all([
        fetch('${import.meta.env.VITE_API_URL}/api/firewall/blocked').then(r => r.json()),
        fetch('${import.meta.env.VITE_API_URL}/api/firewall/stats').then(r => r.json()),
      ]);
      setBlocked(b);
      setStats(s);
    } catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function unblock(ip: string) {
    setUnblocking(ip);
    try {
      await fetch('${import.meta.env.VITE_API_URL}/api/firewall/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      setBlocked(prev => prev.filter(b => b.ip !== ip));
      setStats(prev => ({ ...prev, total_blocked: prev.total_blocked - 1 }));
    } catch { } finally { setUnblocking(null); }
  }

  async function manualBlock() {
    if (!manualIP.trim()) return;
    try {
      await fetch('${import.meta.env.VITE_API_URL}/api/firewall/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: manualIP.trim(), reason: 'Manual block', severity: 'high', signature: 'Manually blocked by operator' }),
      });
      setManualIP('');
      load();
    } catch { }
  }

  const sevColor = (s: string) => s === 'critical' ? RED : s === 'high' ? ORANGE : CYAN;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,10,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        style={{ width: 720, maxHeight: '85vh', background: 'rgba(0,6,18,0.98)', border: `1px solid ${RED}40`, borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: `0 0 60px ${RED}15` }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${RED}25`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${RED}08`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <div>
              <div style={{ fontFamily: font, fontSize: 11, color: RED, letterSpacing: '0.3em', textShadow: `0 0 8px ${RED}` }}>FIREWALL — BLOCKED IPs</div>
              <div style={{ fontFamily: monoFont, fontSize: 8, color: DIM, letterSpacing: '0.15em', marginTop: 2 }}>ACTIVE IPTABLES RULES — AUTO + MANUAL BLOCKS</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: font, fontSize: 20, color: RED, textShadow: `0 0 8px ${RED}` }}>{stats.total_blocked}</div>
              <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em' }}>BLOCKED</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: font, fontSize: 20, color: ORANGE, textShadow: `0 0 8px ${ORANGE}` }}>{stats.critical_blocked}</div>
              <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em' }}>CRITICAL</div>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(0,200,180,0.2)', color: 'rgba(150,200,200,0.6)', fontFamily: monoFont, fontSize: 9, padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.1em' }}>✕ CLOSE</button>
          </div>
        </div>

        {/* Manual block input */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(0,200,180,0.08)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <input value={manualIP} onChange={e => setManualIP(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && manualBlock()}
            placeholder="Enter IP to block manually (e.g. 1.2.3.4)"
            style={{ flex: 1, padding: '6px 12px', background: 'rgba(0,20,40,0.8)', border: '1px solid rgba(255,58,58,0.2)', color: RED, fontFamily: monoFont, fontSize: 9, outline: 'none', borderRadius: 1 }} />
          <button onClick={manualBlock} style={{ padding: '6px 16px', background: `${RED}15`, border: `1px solid ${RED}50`, color: RED, fontFamily: monoFont, fontSize: 9, cursor: 'pointer', letterSpacing: '0.1em' }}>
            🚫 BLOCK IP
          </button>
          <button onClick={load} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(0,200,180,0.2)', color: DIM, fontFamily: monoFont, fontSize: 9, cursor: 'pointer' }}>↻</button>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 180px 1fr 90px', gap: 0, padding: '6px 20px', borderBottom: '1px solid rgba(0,200,180,0.08)', flexShrink: 0 }}>
          {['IP ADDRESS', 'SEV', 'SIGNATURE', 'REASON', 'ACTION'].map(h => (
            <div key={h} style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.15em' }}>{h}</div>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontFamily: monoFont, fontSize: 9, color: DIM }}>Loading...</div>
          ) : blocked.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 10 }}>
              <span style={{ fontSize: 32 }}>✅</span>
              <span style={{ fontFamily: monoFont, fontSize: 10, color: GREEN, letterSpacing: '0.2em' }}>NO IPs CURRENTLY BLOCKED</span>
              <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.3)' }}>Critical alerts will auto-block attackers</span>
            </div>
          ) : (
            <AnimatePresence>
              {blocked.map((b, i) => {
                const col = sevColor(b.severity);
                return (
                  <motion.div key={b.ip} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    style={{ display: 'grid', gridTemplateColumns: '130px 60px 180px 1fr 90px', gap: 0, padding: '8px 20px', borderBottom: '1px solid rgba(0,200,180,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,58,58,0.02)' }}>
                    <span style={{ fontFamily: monoFont, fontSize: 9, color: col, textShadow: `0 0 6px ${col}` }}>{b.ip}</span>
                    <span style={{ fontFamily: monoFont, fontSize: 8, color: col, fontWeight: 700 }}>{b.severity?.toUpperCase()}</span>
                    <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(200,230,230,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{b.signature}</span>
                    <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{b.reason}</span>
                    <button onClick={() => unblock(b.ip)} disabled={unblocking === b.ip}
                      style={{ padding: '3px 8px', background: `${GREEN}10`, border: `1px solid ${GREEN}30`, color: GREEN, fontFamily: monoFont, fontSize: 7, cursor: 'pointer', letterSpacing: '0.1em', opacity: unblocking === b.ip ? 0.5 : 1 }}>
                      {unblocking === b.ip ? '...' : '✓ UNBLOCK'}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 20px', borderTop: '1px solid rgba(0,200,180,0.08)', fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.3)', letterSpacing: '0.1em', flexShrink: 0 }}>
          ⚡ AUTO-BLOCK: Critical severity alerts are blocked automatically via iptables • Manual blocks persist across restarts
        </div>
      </motion.div>
    </motion.div>
  );
}