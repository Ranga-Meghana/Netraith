import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terrain3D, Terrain3DHandle } from './Terrain3D';
import { MiniGlobe } from './MiniGlobe';
import { useAlertsStore } from '../store/alertsStore';
import { LogsPage } from './LogsPage';
import { AnalyticsPage } from './AnalyticsPage';
import { NodesPage } from './NodesPage';
import { InsiderThreatPanel } from './InsiderThreat';
import { AIExplainModal } from './AIExplainModal';
import { useAlertEnhancements, applyThreatTheme } from '../hooks/useAlertEnhancements';
import { BlockedIPsPanel } from './BlockedIPs';
import { ThreatMap } from './ThreatMap';

const font = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';

const CYAN   = '#00FFD4';
const TEAL   = '#00D4C8';
const RED    = '#FF3A3A';
const ORANGE = '#FF6B00';
const DIM    = 'rgba(0,220,200,0.55)';

function GlassPanel({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: 'rgba(0,12,25,0.75)',
      border: '1px solid rgba(0,200,180,0.18)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 2,
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatRow({ label, value, color = CYAN, bar }: { label: string; value: string | number; color?: string; bar?: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontFamily: monoFont, fontSize: 10, color: 'rgba(150,200,200,0.55)', letterSpacing: '0.15em' }}>{label}</span>
        <span style={{ fontFamily: monoFont, fontSize: 11, color, textShadow: `0 0 8px ${color}` }}>{value}</span>
      </div>
      {bar !== undefined && (
        <div style={{ height: 2, background: 'rgba(0,200,180,0.1)', borderRadius: 1 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${bar}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{ height: '100%', background: color, borderRadius: 1, boxShadow: `0 0 6px ${color}` }}
          />
        </div>
      )}
    </div>
  );
}

type Alert = {
  id: number;
  ip: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  location: string;
  time: string;
  col: number;
  row: number;
};

let alertId = 1;
function genAlert(): Alert {
  const types = ['SQL INJECTION', 'BRUTE FORCE', 'DDoS WAVE', 'ZERO-DAY', 'PORT SCAN', 'DATA EXFIL', 'MAN-IN-MIDDLE', 'RANSOMWARE'];
  const locs  = ['EAST-EU', 'SOUTH-AS', 'NORTH-AM', 'EAST-AS', 'WEST-EU', 'MID-EAST', 'AFRICA'];
  const sevs: Alert['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM'];
  const sev = sevs[Math.floor(Math.random() * sevs.length)];
  const ip  = `${Math.floor(Math.random() * 220 + 10)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  return {
    id: alertId++, ip,
    type:     types[Math.floor(Math.random() * types.length)],
    severity: sev,
    location: locs[Math.floor(Math.random() * locs.length)],
    time:     new Date().toISOString().substring(11, 19),
    col:      Math.floor(Math.random() * 50 + 4),
    row:      Math.floor(Math.random() * 28 + 3),
  };
}

function mapSeverity(s: string): Alert['severity'] {
  if (s === 'critical') return 'CRITICAL';
  if (s === 'high')     return 'HIGH';
  return 'MEDIUM';
}

// u2500u2500 Clean readable labels for Suricata raw signatures u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500
function mapSignature(raw: string): string {
  if (!raw) return 'Unknown Threat';
  const r = raw.toUpperCase();
  if (r.includes('DOS') || r.includes('DDOS') || r.includes('FLOOD') || r.includes('SYN')) return 'DDoS Attack';
  if (r.includes('SQL') || r.includes('SQLI')) return 'SQL Injection';
  if (r.includes('XSS')) return 'XSS Attack';
  if (r.includes('BRUTE') || r.includes('BRUTEFORCE')) return 'Brute Force';
  if (r.includes('SSH')) return 'SSH Attack';
  if (r.includes('SCAN') || r.includes('NMAP')) return 'Port Scan';
  if (r.includes('MALWARE') || r.includes('RANSOMWARE')) return 'Malware Detected';
  if (r.includes('C2') || r.includes('BOTNET')) return 'C2 Communication';
  if (r.includes('EXFIL')) return 'Data Exfiltration';
  if (r.includes('EXPLOIT') || r.includes('OVERFLOW')) return 'Exploit Attempt';
  if (r.includes('WEB') || r.includes('HTTP') || r.includes('ATTACK_RESPONSE')) return 'Web Attack';
  if (r.includes('DNS') || r.includes('TUNNEL')) return 'DNS Tunneling';
  if (r.includes('POLICY') || r.includes('SUSPICIOUS')) return 'Suspicious Activity';
  return raw.replace(/^(ET|GPL)s+/i, '').substring(0, 28);
}

export function Dashboard() {
  const terrainRef = useRef<Terrain3DHandle>(null);
  const [activeNav, setActiveNav]           = useState('DASHBOARD');
  const [alerts, setAlerts]                 = useState<Alert[]>(() => Array.from({ length: 4 }, genAlert));
  const [scanning, setScanning]             = useState(false);
  const [simulating, setSimulating]         = useState(false);
  const [threatLevel, setThreatLevel]       = useState(72);
  const [totalBlocked, setTotalBlocked]     = useState(1893);
  const [activeNodes, setActiveNodes]       = useState(12847);
  const [floatingCards, setFloatingCards]   = useState<(Alert & { x: number; y: number })[]>([]);
  const [signalStrength, setSignalStrength] = useState(87);
  const [cpuLoad, setCpuLoad]               = useState(43);
  const [memUsage, setMemUsage]             = useState(61);
  const [networkBw, setNetworkBw]           = useState(78);
  const [soundEnabled, setSoundEnabled]     = useState(true);
  const [aiAlert, setAiAlert]               = useState<any>(null);
  const [showBlocked, setShowBlocked]       = useState(false);
  const [autoBlockCount, setAutoBlockCount] = useState(0);

  // ── Live data from Socket.IO store ────────────────────────────────────────
  const liveAlerts  = useAlertsStore((s) => s.alerts);
  const isConnected = useAlertsStore((s) => s.connected);

  // ── Sound + Notifications + Theme shifting ────────────────────────────────
  useAlertEnhancements(liveAlerts, threatLevel, soundEnabled);

  // ── Listen for auto-block events ──────────────────────────────────────────
  useEffect(() => {
    const handler = () => setAutoBlockCount(n => n + 1);
    window.addEventListener('ip_blocked', handler);
    return () => window.removeEventListener('ip_blocked', handler);
  }, []);

  // Track how many live alerts we've already processed
  const processedCountRef = useRef(0);

  const spawnThreat = useCallback((alert: Alert) => {
    terrainRef.current?.triggerThreat(alert.col, alert.row);
    const x = 20 + Math.random() * 60;
    const y = 15 + Math.random() * 60;
    setFloatingCards(prev => [...prev.slice(-2), { ...alert, x, y }]);
    setTimeout(() => setFloatingCards(prev => prev.filter(c => c.id !== alert.id)), 5000);
  }, []);

  // ── Demo alerts — only when NOT connected ─────────────────────────────────
  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      const a = genAlert();
      setAlerts(prev => [a, ...prev].slice(0, 8));
      setTotalBlocked(n => n + Math.floor(Math.random() * 3 + 1));
      setThreatLevel(n => Math.max(40, Math.min(95, n + (Math.random() - 0.45) * 8)));
      spawnThreat(a);
    }, 2800);
    return () => clearInterval(interval);
  }, [isConnected, spawnThreat]);

  // ── Consume LIVE alerts from backend ─────────────────────────────────────
  // Uses liveAlerts.length so it fires on EVERY new alert, not just first
  useEffect(() => {
    if (liveAlerts.length === 0) return;
    if (liveAlerts.length <= processedCountRef.current) return;

    // Process all new alerts since last render
    const newAlerts = liveAlerts.slice(0, liveAlerts.length - processedCountRef.current);
    processedCountRef.current = liveAlerts.length;

    newAlerts.forEach(latest => {
      console.log("[Dashboard] Processing live alert:", latest);

      const mapped: Alert = {
        id:       alertId++,
        ip:       latest.srcIp,
        type:     mapSignature(latest.signature || latest.category || ""),
        severity: mapSeverity(latest.severity),
        location: 'LIVE',
        time:     new Date(latest.timestamp).toISOString().substring(11, 19),
        col:      Math.floor(Math.random() * 50 + 4),
        row:      Math.floor(Math.random() * 28 + 3),
      };

      setAlerts(prev => [mapped, ...prev].slice(0, 8));
      setTotalBlocked(n => n + 1);
      setThreatLevel(n => Math.max(40, Math.min(95,
        n + (mapped.severity === 'CRITICAL' ? 6 : mapped.severity === 'HIGH' ? 3 : 1)
      )));
      spawnThreat(mapped);
    });
  }, [liveAlerts.length, spawnThreat]); // ← fires on every new alert

  // ── Stat fluctuation ──────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNodes(n    => n + Math.floor(Math.random() * 10 - 3));
      setSignalStrength(n => Math.max(60, Math.min(99, n + (Math.random() - 0.5) * 6)));
      setCpuLoad(n         => Math.max(20, Math.min(90, n + (Math.random() - 0.5) * 8)));
      setMemUsage(n        => Math.max(30, Math.min(85, n + (Math.random() - 0.5) * 5)));
      setNetworkBw(n       => Math.max(30, Math.min(98, n + (Math.random() - 0.5) * 10)));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  function handleScan() {
    setScanning(true);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const a = genAlert();
        setAlerts(prev => [a, ...prev].slice(0, 8));
        spawnThreat(a);
      }, i * 500);
    }
    setTimeout(() => setScanning(false), 3000);
  }

  function handleSimulate() {
    setSimulating(true);
    setThreatLevel(95);
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const a = { ...genAlert(), severity: 'CRITICAL' as const };
        setAlerts(prev => [a, ...prev].slice(0, 8));
        spawnThreat(a);
        setTotalBlocked(n => n + Math.floor(Math.random() * 5 + 2));
      }, i * 400);
    }
    setTimeout(() => { setSimulating(false); setThreatLevel(72); }, 4000);
  }

  const sevColor    = (s: string) => s === 'CRITICAL' ? RED : s === 'HIGH' ? ORANGE : '#FFD700';
  const threatColor = threatLevel > 80 ? RED : threatLevel > 60 ? ORANGE : '#FFD700';
  const navItems    = ['DASHBOARD', 'THREAT MAP', 'LOGS', 'ANALYTICS', 'NODES'];

  return (
    <div style={{
      width: '100%', height: '100%', background: '#000814',
      overflow: 'hidden', position: 'relative', fontFamily: monoFont,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Scan lines */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,180,0.008) 3px, rgba(0,255,180,0.008) 4px)' }} />

      {/* Corner decorations */}
      {[
        { top: 0,    left: 0,  borderTop:    `2px solid ${CYAN}`, borderLeft:  `2px solid ${CYAN}` },
        { top: 0,    right: 0, borderTop:    `2px solid ${CYAN}`, borderRight: `2px solid ${CYAN}` },
        { bottom: 0, left: 0,  borderBottom: `2px solid ${CYAN}`, borderLeft:  `2px solid ${CYAN}` },
        { bottom: 0, right: 0, borderBottom: `2px solid ${CYAN}`, borderRight: `2px solid ${CYAN}` },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 20, height: 20, zIndex: 110, ...s }} />
      ))}

      {/* TOP NAV */}
      <GlassPanel style={{ padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid rgba(0,200,180,0.2)', borderRadius: 0, flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
          <svg width="28" height="28" viewBox="0 0 80 80" fill="none">
            <polygon points="40,4 73,22 73,58 40,76 7,58 7,22" stroke={CYAN} strokeWidth="1.5" opacity="0.9" />
            <polygon points="40,18 62,28 62,52 40,64 18,52 18,28" stroke="#00D4FF" strokeWidth="0.8" opacity="0.5" />
            <circle cx="40" cy="40" r="5" fill={CYAN} opacity="0.9" />
            <circle cx="40" cy="40" r="2.5" fill="white" opacity="0.95" />
            {[{x:40,y:4},{x:73,y:22},{x:73,y:58},{x:40,y:76},{x:7,y:58},{x:7,y:22}].map((n,i) => (
              <circle key={i} cx={n.x} cy={n.y} r="2.5" fill={CYAN} opacity="0.9"/>
            ))}
          </svg>
          <span style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: CYAN, letterSpacing: '0.2em', textShadow: `0 0 12px ${CYAN}` }}>NETRAITH</span>
        </div>

        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {navItems.map(item => (
            <button key={item} onClick={() => setActiveNav(item)} style={{
              padding: '4px 14px',
              background: activeNav === item ? 'rgba(0,255,212,0.08)' : 'transparent',
              border: activeNav === item ? `1px solid rgba(0,255,212,0.35)` : '1px solid transparent',
              color: activeNav === item ? CYAN : 'rgba(150,200,200,0.5)',
              fontFamily: monoFont, fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 1,
              textShadow: activeNav === item ? `0 0 8px ${CYAN}` : 'none', transition: 'all 0.2s',
            }}>{item}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#00FF88' : ORANGE, boxShadow: `0 0 8px ${isConnected ? '#00FF88' : ORANGE}` }} />
            <span style={{ fontFamily: monoFont, fontSize: 9, color: isConnected ? '#00CC66' : ORANGE, letterSpacing: '0.2em' }}>
              {isConnected ? 'BACKEND LIVE' : 'DEMO MODE'}
            </span>
          </div>
          {/* Sound toggle */}
          <button onClick={() => setSoundEnabled(s => !s)} title="Toggle alert sounds"
            style={{ background: 'transparent', border: `1px solid ${soundEnabled ? 'rgba(0,255,212,0.3)' : 'rgba(150,150,150,0.2)'}`, color: soundEnabled ? CYAN : 'rgba(150,150,150,0.4)', fontFamily: monoFont, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 1, letterSpacing: '0.1em' }}>
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          {/* Firewall button */}
          <button onClick={() => setShowBlocked(true)} title="View blocked IPs"
            style={{ background: autoBlockCount > 0 ? `${RED}15` : 'transparent', border: `1px solid ${autoBlockCount > 0 ? RED + '60' : 'rgba(255,58,58,0.25)'}`, color: RED, fontFamily: monoFont, fontSize: 9, padding: '2px 10px', cursor: 'pointer', borderRadius: 1, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5 }}>
            🛡️ FIREWALL {autoBlockCount > 0 && <span style={{ background: RED, color: 'white', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7 }}>{autoBlockCount}</span>}
          </button>
          {simulating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: RED, boxShadow: `0 0 8px ${RED}` }} />
              <span style={{ fontFamily: monoFont, fontSize: 9, color: RED, letterSpacing: '0.2em' }}>ATTACK ACTIVE</span>
            </div>
          )}
          <div style={{ fontFamily: monoFont, fontSize: 9, color: DIM, letterSpacing: '0.15em' }}>
            {new Date().toISOString().substring(0, 19).replace('T', ' ')} UTC
          </div>
        </div>
      </GlassPanel>

      {/* MAIN BODY */}
      {activeNav === 'THREAT MAP' ? (
        <div style={{ flex: 1, minHeight: 0 }}><ThreatMap /></div>
      ) : activeNav === 'LOGS' ? (
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}><LogsPage /></div>
      ) : activeNav === 'ANALYTICS' ? (
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}><AnalyticsPage /></div>
      ) : activeNav === 'NODES' ? (
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}><NodesPage /></div>
      ) : (
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 200px', gridTemplateRows: '1fr 110px', gap: 0, overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 10, paddingRight: 5, overflowY: 'auto', borderRight: '1px solid rgba(0,200,180,0.1)' }}>
          <GlassPanel style={{ padding: '12px 14px', marginBottom: 6 }}>
            <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 12, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>SYSTEM STATUS</div>
            <StatRow label="CPU LOAD"    value={`${Math.round(cpuLoad)}%`}        color={cpuLoad > 75 ? ORANGE : CYAN}  bar={cpuLoad} />
            <StatRow label="MEMORY"      value={`${Math.round(memUsage)}%`}       color={memUsage > 80 ? ORANGE : CYAN} bar={memUsage} />
            <StatRow label="NETWORK BW"  value={`${Math.round(networkBw)}%`}      color={CYAN}                           bar={networkBw} />
            <StatRow label="SIGNAL STR." value={`${Math.round(signalStrength)}%`} color={TEAL}                           bar={signalStrength} />
          </GlassPanel>

          <GlassPanel style={{ padding: '12px 14px', marginBottom: 6 }}>
            <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 12, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>NETWORK NODES</div>
            {[
              { label: 'TOTAL NODES',  value: activeNodes.toLocaleString(),                    online: true  },
              { label: 'ONLINE',       value: Math.round(activeNodes * 0.94).toLocaleString(),  online: true  },
              { label: 'COMPROMISED',  value: Math.round(activeNodes * 0.005).toString(),       online: false },
              { label: 'ISOLATED',     value: Math.round(activeNodes * 0.008).toString(),       online: null  },
            ].map(n => (
              <div key={n.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: n.online === true ? '#00FF88' : n.online === false ? RED : ORANGE, boxShadow: `0 0 5px ${n.online === true ? '#00FF88' : n.online === false ? RED : ORANGE}` }} />
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.5)', letterSpacing: '0.1em' }}>{n.label}</span>
                </div>
                <span style={{ fontFamily: monoFont, fontSize: 10, color: CYAN }}>{n.value}</span>
              </div>
            ))}
          </GlassPanel>

          <GlassPanel style={{ padding: '10px 14px' }}>
            <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 8, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>GLOBAL VIEW</div>
            <div style={{ height: 120 }}><MiniGlobe /></div>
          </GlassPanel>
        </div>

        {/* CENTER — 3D TERRAIN */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <Terrain3D ref={terrainRef} />

          <AnimatePresence>
            {floatingCards.map(card => (
              <motion.div key={card.id}
                initial={{ opacity: 0, scale: 0.7, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: -10 }}
                transition={{ duration: 0.4 }}
                style={{ position: 'absolute', left: `${card.x}%`, top: `${card.y}%`, zIndex: 20, minWidth: 180, background: 'rgba(0,6,16,0.88)', border: `1px solid ${card.severity === 'CRITICAL' ? 'rgba(255,50,50,0.6)' : 'rgba(255,100,0,0.5)'}`, backdropFilter: 'blur(10px)', padding: '10px 14px', borderRadius: 2, boxShadow: `0 0 20px ${card.severity === 'CRITICAL' ? 'rgba(255,50,50,0.3)' : 'rgba(255,100,0,0.2)'}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: font, fontSize: 8, color: RED, letterSpacing: '0.25em', textShadow: `0 0 8px ${RED}` }}>
                    {card.location === 'LIVE' ? '⚡ LIVE THREAT' : '⚠ THREAT DETECTED'}
                  </span>
                  <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                    style={{ width: 5, height: 5, borderRadius: '50%', background: RED, boxShadow: `0 0 8px ${RED}` }} />
                </div>
                <div style={{ fontFamily: monoFont, fontSize: 10, color: 'rgba(255,180,180,0.9)', marginBottom: 3 }}>{card.ip}</div>
                <div style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(200,150,150,0.7)', marginBottom: 4, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.type}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: sevColor(card.severity), textShadow: `0 0 6px ${sevColor(card.severity)}` }}>{card.severity}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: card.location === 'LIVE' ? CYAN : 'rgba(150,200,200,0.4)' }}>{card.location}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {scanning && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
                <motion.div animate={{ top: ['-5%', '105%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                  style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(0,255,212,0.8), transparent)', boxShadow: '0 0 20px rgba(0,255,212,0.5)' }} />
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.3em', background: 'rgba(0,12,25,0.6)', padding: '4px 16px', border: '1px solid rgba(0,200,180,0.15)' }}>
            NETWORK THREAT TERRAIN — SECTOR 01
          </div>
          <div style={{ position: 'absolute', bottom: 12, left: 14, fontFamily: monoFont, fontSize: 8, color: 'rgba(0,200,180,0.3)', letterSpacing: '0.15em' }}>37°46'N 122°25'W</div>
          <div style={{ position: 'absolute', bottom: 12, right: 14, fontFamily: monoFont, fontSize: 8, color: 'rgba(0,200,180,0.3)', letterSpacing: '0.15em' }}>ALT: 12,400m</div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 10, paddingLeft: 5, overflowY: 'auto', borderLeft: '1px solid rgba(0,200,180,0.1)' }}>
          <GlassPanel style={{ padding: '12px 14px', marginBottom: 6 }}>
            <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 10, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>THREAT LEVEL</div>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <motion.div animate={{ textShadow: [`0 0 15px ${threatColor}`, `0 0 30px ${threatColor}`, `0 0 15px ${threatColor}`] }} transition={{ duration: 2, repeat: Infinity }}
                style={{ fontFamily: font, fontSize: 32, fontWeight: 900, color: threatColor, lineHeight: 1 }}>
                {Math.round(threatLevel)}
              </motion.div>
              <div style={{ fontFamily: monoFont, fontSize: 9, color: threatColor, letterSpacing: '0.2em', marginTop: 2, opacity: 0.8 }}>
                {threatLevel > 80 ? 'CRITICAL' : threatLevel > 60 ? 'HIGH' : 'MODERATE'}
              </div>
            </div>
            <div style={{ position: 'relative', height: 4, background: 'rgba(0,200,180,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${threatLevel}%` }} transition={{ duration: 0.8 }}
                style={{ height: '100%', background: `linear-gradient(90deg, ${TEAL}, ${threatColor})`, boxShadow: `0 0 8px ${threatColor}` }} />
            </div>
          </GlassPanel>

          <GlassPanel style={{ padding: '12px 14px', marginBottom: 6 }}>
            <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 10, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>STATISTICS</div>
            <StatRow label="BLOCKED TODAY"  value={totalBlocked.toLocaleString()}                         color={CYAN}   />
            <StatRow label="ACTIVE THREATS" value={alerts.filter(a => a.severity === 'CRITICAL').length}  color={RED}    />
            <StatRow label="HIGH SEVERITY"  value={alerts.filter(a => a.severity === 'HIGH').length}      color={ORANGE} />
            <StatRow label="ANALYZED/HR"    value="8,234"                                                  color={TEAL}   />
          </GlassPanel>

          <GlassPanel style={{ padding: '12px 14px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 10, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>ACTIVE ALERTS</div>
            <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <AnimatePresence mode="popLayout">
                {alerts.slice(0, 6).map(a => (
                  <motion.div key={a.id}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.3 }}
                    style={{ padding: '6px 8px', background: `rgba(${a.severity === 'CRITICAL' ? '255,40,40' : a.severity === 'HIGH' ? '255,100,0' : '200,160,0'},0.06)`, border: `1px solid rgba(${a.severity === 'CRITICAL' ? '255,40,40' : a.severity === 'HIGH' ? '255,100,0' : '200,160,0'},0.2)`, borderRadius: 1 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontFamily: monoFont, fontSize: 8, color: sevColor(a.severity), textShadow: `0 0 6px ${sevColor(a.severity)}` }}>{a.severity}</span>
                      <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.35)' }}>{a.time}</span>
                    </div>
                    <div style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(200,230,230,0.7)', marginBottom: 1 }}>{a.ip}</div>
                    <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.type}</div>
                    <button
                      onClick={() => setAiAlert({ id: a.id, signature: a.type, severity: a.severity?.toLowerCase(), src_ip: a.ip, proto: 'TCP', category: a.type })}
                      style={{ marginTop: 4, padding: '2px 6px', background: 'rgba(0,255,212,0.06)', border: '1px solid rgba(0,255,212,0.2)', color: 'rgba(0,255,212,0.6)', fontFamily: monoFont, fontSize: 7, cursor: 'pointer', letterSpacing: '0.1em', borderRadius: 1 }}>
                      🤖 AI EXPLAIN
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </GlassPanel>
        </div>

        {/* BOTTOM CONTROL BAR */}
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,200,180,0.15)', background: 'rgba(0,8,18,0.9)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 110, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 20, flex: 1, alignItems: 'center' }}>
            {[
              { label: 'ALTITUDE',   value: '350 m'                     },
              { label: 'PULSE PWR',  value: `${Math.round(networkBw)}%` },
              { label: 'SCAN DEPTH', value: '4.2 km'                    },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.45)', letterSpacing: '0.15em' }}>{item.label}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 8, color: CYAN }}>{item.value}</span>
                </div>
                <div style={{ height: 2, background: 'rgba(0,200,180,0.12)', borderRadius: 1 }}>
                  <div style={{ height: '100%', width: '60%', background: `linear-gradient(90deg, ${TEAL}, ${CYAN})`, borderRadius: 1, boxShadow: `0 0 6px ${CYAN}` }} />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.45)', letterSpacing: '0.15em' }}>SAFE MODE</span>
              <div style={{ width: 32, height: 16, borderRadius: 8, background: 'rgba(0,255,212,0.15)', border: '1px solid rgba(0,255,212,0.3)', position: 'relative' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: CYAN, position: 'absolute', top: 1, left: 2, boxShadow: `0 0 6px ${CYAN}` }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'SCAN NETWORK',    action: handleScan,                                          active: scanning,   color: CYAN   },
              { label: 'SIMULATE ATTACK', action: handleSimulate,                                      active: simulating, color: ORANGE },
              { label: 'EMERGENCY STOP',  action: () => { setSimulating(false); setThreatLevel(40); }, active: false,      color: RED    },
            ].map(btn => (
              <motion.button key={btn.label} onClick={btn.action} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                style={{ padding: '10px 18px', background: btn.active ? `rgba(${btn.color === CYAN ? '0,255,212' : btn.color === ORANGE ? '255,107,0' : '255,50,50'},0.12)` : 'rgba(0,12,25,0.8)', border: `1px solid ${btn.color}${btn.active ? 'AA' : '40'}`, color: btn.color, fontFamily: monoFont, fontSize: 9, letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 1, textShadow: btn.active ? `0 0 10px ${btn.color}` : 'none', boxShadow: btn.active ? `0 0 20px ${btn.color}30, inset 0 0 15px ${btn.color}08` : 'none', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
              >
                {btn.active && (
                  <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `linear-gradient(90deg, transparent, ${btn.color}20, transparent)` }} />
                )}
                {btn.label}
              </motion.button>
            ))}
          </div>

          <div style={{ width: 90, height: 90, position: 'relative', flexShrink: 0 }}>
            <svg width="90" height="90" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(0,200,180,0.12)" strokeWidth="1"/>
              <circle cx="45" cy="45" r="28" fill="none" stroke="rgba(0,200,180,0.1)"  strokeWidth="1"/>
              <circle cx="45" cy="45" r="15" fill="none" stroke="rgba(0,200,180,0.12)" strokeWidth="1"/>
              <line x1="5" y1="45" x2="85" y2="45" stroke="rgba(0,200,180,0.08)" strokeWidth="1"/>
              <line x1="45" y1="5" x2="45" y2="85" stroke="rgba(0,200,180,0.08)" strokeWidth="1"/>
              <motion.line x1="45" y1="45" x2="85" y2="45" stroke={CYAN} strokeWidth="1.5"
                style={{ transformOrigin: '45px 45px' }} animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} opacity="0.7" />
              {[{cx:55,cy:30},{cx:25,cy:50},{cx:60,cy:58},{cx:38,cy:22}].map((d,i) => (
                <motion.circle key={i} cx={d.cx} cy={d.cy} r="2" fill={i === 0 ? RED : CYAN}
                  animate={{ opacity: [0.8, 0.1, 0.8] }} transition={{ duration: 1.8, delay: i * 0.5, repeat: Infinity }} />
              ))}
            </svg>
            <div style={{ position: 'absolute', bottom: -4, left: 0, right: 0, textAlign: 'center', fontFamily: monoFont, fontSize: 7, color: 'rgba(0,200,180,0.4)', letterSpacing: '0.15em' }}>RADAR</div>
          </div>
        </div>
      </div>
      )}
      {/* Insider Threat floating panel — appears when insider alerts detected */}
      <InsiderThreatPanel />

      {/* AI Explain Modal */}
      <AnimatePresence>
        {aiAlert && <AIExplainModal alert={aiAlert} onClose={() => setAiAlert(null)} />}
      </AnimatePresence>

      {/* Blocked IPs Panel */}
      <AnimatePresence>
        {showBlocked && <BlockedIPsPanel onClose={() => setShowBlocked(false)} />}
      </AnimatePresence>

      {/* Threat level overlay — shifts UI color based on threat */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 99, background: 'var(--threat-overlay, transparent)', transition: 'background 2s ease', boxShadow: 'var(--threat-glow, none)' }} />
    </div>
  );
}