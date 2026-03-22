import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlertsStore } from '../store/alertsStore';

const font     = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';
const MAGENTA  = '#FF00FF';
const RED      = '#FF3A3A';
const ORANGE   = '#FF6B00';
const CYAN     = '#00FFD4';
const DIM      = 'rgba(0,220,200,0.55)';

const INSIDER_KEYWORDS = [
  'insider', 'after-hours', 'unusual outbound', 'mass file',
  'privilege escalation - internal', 'usb', 'policy',
  'removable', 'data theft', 'unauthorized access',
];

function isInsider(alert: any): boolean {
  if (alert.insider) return true;
  const sig = (alert.signature || '').toLowerCase();
  const cat = (alert.category  || '').toLowerCase();
  return INSIDER_KEYWORDS.some(k => sig.includes(k) || cat.includes(k));
}

const RISK_SCORE: Record<string, number> = {
  'Insider Threat - Data Exfiltration':  95,
  'Insider Threat - Privilege Abuse':    90,
  'Insider Threat - Data Theft':         85,
  'Insider Threat - Unauthorized Access':75,
  'Insider Threat - Removable Media':    60,
};

function getRisk(category: string): number {
  return RISK_SCORE[category] ?? 50;
}

export function InsiderThreatPanel() {
  const liveAlerts = useAlertsStore((s) => s.alerts);

  const insiderAlerts = useMemo(
    () => liveAlerts.filter(isInsider),
    [liveAlerts]
  );

  const topIPs = useMemo(() => {
    const counts: Record<string, { count: number; maxRisk: number; categories: Set<string> }> = {};
    insiderAlerts.forEach(a => {
      if (!counts[a.srcIp]) counts[a.srcIp] = { count: 0, maxRisk: 0, categories: new Set() };
      counts[a.srcIp].count++;
      counts[a.srcIp].maxRisk = Math.max(counts[a.srcIp].maxRisk, getRisk(a.category));
      counts[a.srcIp].categories.add(a.category);
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].maxRisk - a[1].maxRisk)
      .slice(0, 5);
  }, [insiderAlerts]);

  if (insiderAlerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'fixed', bottom: 130, right: 20, width: 320, zIndex: 50,
        background: 'rgba(20,0,30,0.95)',
        border: `1px solid ${MAGENTA}60`,
        backdropFilter: 'blur(16px)',
        borderRadius: 2,
        boxShadow: `0 0 30px ${MAGENTA}30`,
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${MAGENTA}30`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: MAGENTA, boxShadow: `0 0 8px ${MAGENTA}` }}
          />
          <span style={{ fontFamily: font, fontSize: 9, color: MAGENTA, letterSpacing: '0.25em', textShadow: `0 0 8px ${MAGENTA}` }}>
            INSIDER THREAT DETECTED
          </span>
        </div>
        <span style={{ fontFamily: font, fontSize: 14, fontWeight: 900, color: MAGENTA, textShadow: `0 0 10px ${MAGENTA}` }}>
          {insiderAlerts.length}
        </span>
      </div>

      {/* Risk indicators */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontFamily: monoFont, fontSize: 8, color: `${MAGENTA}80`, letterSpacing: '0.15em', marginBottom: 8 }}>
          HIGH-RISK INTERNAL SOURCES
        </div>
        {topIPs.map(([ip, data]) => (
          <div key={ip} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: MAGENTA }}>{ip}</span>
              <span style={{ fontFamily: monoFont, fontSize: 8, color: data.maxRisk > 80 ? RED : ORANGE }}>
                RISK: {data.maxRisk}%
              </span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,0,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.maxRisk}%` }}
                transition={{ duration: 1 }}
                style={{ height: '100%', background: `linear-gradient(90deg, ${MAGENTA}, ${RED})`, boxShadow: `0 0 6px ${MAGENTA}` }}
              />
            </div>
            <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(255,150,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[...data.categories][0]}
            </div>
          </div>
        ))}
      </div>

      {/* Recent insider alerts */}
      <div style={{ borderTop: `1px solid ${MAGENTA}20`, padding: '8px 14px', maxHeight: 160, overflowY: 'auto' }}>
        <div style={{ fontFamily: monoFont, fontSize: 8, color: `${MAGENTA}60`, letterSpacing: '0.15em', marginBottom: 6 }}>RECENT EVENTS</div>
        <AnimatePresence mode="popLayout">
          {insiderAlerts.slice(0, 5).map(a => (
            <motion.div key={a.id}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              style={{ marginBottom: 5, padding: '5px 8px', background: `${MAGENTA}08`, border: `1px solid ${MAGENTA}20`, borderRadius: 1 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontFamily: monoFont, fontSize: 8, color: MAGENTA }}>{a.srcIp}</span>
                <span style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(200,150,200,0.5)' }}>
                  {new Date(a.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(255,200,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.signature}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer warning */}
      <div style={{ padding: '6px 14px', borderTop: `1px solid ${MAGENTA}20`, background: `${MAGENTA}08` }}>
        <div style={{ fontFamily: monoFont, fontSize: 7, color: `${MAGENTA}70`, letterSpacing: '0.1em', textAlign: 'center' }}>
          ⚠ INTERNAL NETWORK ANOMALY — INVESTIGATE IMMEDIATELY
        </div>
      </div>
    </motion.div>
  );
}