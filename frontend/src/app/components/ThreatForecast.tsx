import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const font     = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';
const CYAN     = '#00FFD4';
const RED      = '#FF3A3A';
const ORANGE   = '#FF6B00';
const GREEN    = '#00FF88';
const DIM      = 'rgba(0,220,200,0.55)';

interface Prediction {
  attack_type: string; probability: number; confidence: number;
  time_window: string; next_hours: number; severity: string;
  based_on: number; trend: string;
}

interface ForecastData {
  status: string; generated_at: string; total_analyzed: number;
  predictions: Prediction[]; risk_score: number; peak_hours: number[];
  top_sources: { ip: string; count: number }[];
  trend: string; next_attack: Prediction | null; summary: string;
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: RED, HIGH: ORANGE, MEDIUM: '#FFD700',
};

const TREND_ICON: Record<string, string> = {
  escalating: '🔺', stable: '➡️', declining: '🔻',
};

const ATTACK_ICON: Record<string, string> = {
  'DDoS Attack':       '🌊',
  'Web Attack':        '🕸️',
  'Brute Force':       '🔨',
  'Malware/C2':        '🦠',
  'Port Scan':         '🔍',
  'Insider Threat':    '👤',
  'Data Exfiltration': '📤',
  'Unknown':           '⚠️',
};

function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'rgba(0,12,25,0.75)', border: '1px solid rgba(0,200,180,0.18)', backdropFilter: 'blur(12px)', borderRadius: 2, padding: '14px 16px', ...style }}>
      {children}
    </div>
  );
}

function ProbabilityBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, background: 'rgba(0,200,180,0.08)', borderRadius: 3, overflow: 'hidden', flex: 1 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ height: '100%', background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 8px ${color}`, borderRadius: 3 }}
      />
    </div>
  );
}

export function ThreatForecast() {
  const [data,     setData]     = useState<ForecastData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${(import.meta as any).env?.VITE_API_URL ?? 'https://netraith-backend.onrender.com'}/api/predict/`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError('Backend not connected — start the server to see predictions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [load]);

  const trendColor = data?.trend === 'escalating' ? RED
                   : data?.trend === 'declining'  ? GREEN
                   : CYAN;

  return (
    <div style={{ width: '100%', height: '100%', background: '#000814', overflow: 'auto', padding: 16, fontFamily: monoFont }}>
      {/* Scan lines */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,180,0.005) 3px, rgba(0,255,180,0.005) 4px)' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, zIndex: 1, position: 'relative' }}>
        <div>
          <div style={{ fontFamily: font, fontSize: 13, color: CYAN, letterSpacing: '0.35em', textShadow: `0 0 10px ${CYAN}` }}>
            🔮 THREAT FORECAST
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 9, color: DIM, letterSpacing: '0.2em', marginTop: 2 }}>
            AI-POWERED PREDICTIVE THREAT INTELLIGENCE
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {data && (
            <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em' }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
          <button onClick={load} disabled={loading}
            style={{ padding: '5px 14px', background: `${CYAN}10`, border: `1px solid ${CYAN}40`, color: CYAN, fontFamily: monoFont, fontSize: 8, cursor: 'pointer', letterSpacing: '0.15em', borderRadius: 1, opacity: loading ? 0.5 : 1 }}>
            {loading ? '⟳ ANALYZING...' : '↻ REFRESH'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: 16, background: `${ORANGE}10`, border: `1px solid ${ORANGE}30`, borderRadius: 2, fontFamily: monoFont, fontSize: 9, color: ORANGE, marginBottom: 16, zIndex: 1, position: 'relative' }}>
          ⚠ {error}
        </div>
      )}

      {/* Insufficient data */}
      {data?.status === 'insufficient_data' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16, zIndex: 1, position: 'relative' }}>
          <span style={{ fontSize: 48 }}>🔮</span>
          <span style={{ fontFamily: font, fontSize: 11, color: CYAN, letterSpacing: '0.3em' }}>INSUFFICIENT DATA</span>
          <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.15em', textAlign: 'center' }}>
            Simulate attacks or wait for real Suricata alerts<br />to generate threat predictions
          </span>
        </div>
      )}

      {data?.status === 'ok' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 12, zIndex: 1, position: 'relative' }}>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'RISK SCORE',     value: `${data.risk_score}/100`, color: data.risk_score > 70 ? RED : data.risk_score > 40 ? ORANGE : GREEN, icon: '🎯' },
              { label: 'THREAT TREND',   value: `${TREND_ICON[data.trend]} ${data.trend.toUpperCase()}`, color: trendColor, icon: '📈' },
              { label: 'ALERTS ANALYZED',value: data.total_analyzed,      color: CYAN,   icon: '📊' },
              { label: 'PEAK RISK HOUR', value: `${data.peak_hours[0]}:00 UTC`, color: ORANGE, icon: '⏰' },
            ].map(k => (
              <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(0,12,25,0.75)', border: `1px solid ${k.color}25`, backdropFilter: 'blur(12px)', borderRadius: 2, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{k.icon}</span>
                <div>
                  <div style={{ fontFamily: font, fontSize: 14, fontWeight: 900, color: k.color, textShadow: `0 0 8px ${k.color}`, lineHeight: 1.2 }}>{k.value}</div>
                  <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.5)', letterSpacing: '0.12em', marginTop: 3 }}>{k.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* AI Summary */}
          {data.next_attack && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              style={{ padding: '14px 18px', background: `${RED}08`, border: `1px solid ${RED}30`, borderRadius: 2, borderLeft: `4px solid ${RED}`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 32 }}>{ATTACK_ICON[data.next_attack.attack_type] || '⚠️'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: font, fontSize: 9, color: RED, letterSpacing: '0.25em', marginBottom: 4, textShadow: `0 0 6px ${RED}` }}>
                  ⚡ HIGHEST RISK PREDICTION
                </div>
                <div style={{ fontFamily: monoFont, fontSize: 11, color: 'rgba(200,230,230,0.9)', marginBottom: 4 }}>
                  {data.summary}
                </div>
                <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em' }}>
                  Based on {data.next_attack.based_on} historical incidents • Confidence: {Math.round(data.next_attack.confidence * 100)}%
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontFamily: font, fontSize: 28, fontWeight: 900, color: RED, textShadow: `0 0 12px ${RED}` }}>
                  {Math.round(data.next_attack.probability * 100)}%
                </div>
                <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(200,100,100,0.6)', letterSpacing: '0.1em' }}>PROBABILITY</div>
              </div>
            </motion.div>
          )}

          {/* Predictions list + Top Sources */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>

            {/* Predictions */}
            <GlassCard>
              <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 14, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 8 }}>
                ATTACK PROBABILITY FORECAST
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.predictions.map((p, i) => {
                  const col = SEV_COLOR[p.severity] || CYAN;
                  return (
                    <motion.div key={p.attack_type} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{ATTACK_ICON[p.attack_type] || '⚠️'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontFamily: monoFont, fontSize: 10, color: 'rgba(200,230,230,0.9)' }}>{p.attack_type}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: monoFont, fontSize: 8, color: col, fontWeight: 700 }}>{p.severity}</span>
                              <span style={{ fontFamily: font, fontSize: 12, fontWeight: 900, color: col, textShadow: `0 0 6px ${col}` }}>
                                {Math.round(p.probability * 100)}%
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ProbabilityBar value={p.probability} color={col} />
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, paddingLeft: 26 }}>
                        <span style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em' }}>⏱ {p.time_window}</span>
                        <span style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em' }}>📊 {p.based_on} incidents</span>
                        <span style={{ fontFamily: monoFont, fontSize: 7, color: p.trend.includes('↑') ? RED : GREEN, letterSpacing: '0.1em' }}>{p.trend}</span>
                      </div>
                      {i < data.predictions.length - 1 && (
                        <div style={{ height: 1, background: 'rgba(0,200,180,0.06)', marginTop: 12 }} />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </GlassCard>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Top sources */}
              <GlassCard>
                <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 12, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>
                  TOP THREAT SOURCES
                </div>
                {data.top_sources.length === 0 ? (
                  <div style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.3)', textAlign: 'center', padding: 12 }}>No source data</div>
                ) : data.top_sources.map((s, i) => (
                  <div key={s.ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '4px 6px', background: 'rgba(0,200,180,0.03)', border: '1px solid rgba(0,200,180,0.06)', borderRadius: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.3)', width: 14 }}>#{i+1}</span>
                      <span style={{ fontFamily: monoFont, fontSize: 9, color: i === 0 ? RED : CYAN }}>{s.ip}</span>
                    </div>
                    <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: i === 0 ? RED : ORANGE }}>{s.count}</span>
                  </div>
                ))}
              </GlassCard>

              {/* Peak hours */}
              <GlassCard style={{ flex: 1 }}>
                <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 12, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>
                  PEAK ATTACK HOURS (UTC)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.peak_hours.slice(0, 4).map((h, i) => (
                    <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: monoFont, fontSize: 10, color: i === 0 ? RED : ORANGE, width: 45 }}>{String(h).padStart(2,'0')}:00</span>
                      <div style={{ flex: 1, height: 4, background: 'rgba(0,200,180,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(4 - i) / 4 * 100}%` }} transition={{ duration: 1, delay: i * 0.2 }}
                          style={{ height: '100%', background: i === 0 ? RED : ORANGE, boxShadow: `0 0 4px ${i === 0 ? RED : ORANGE}`, borderRadius: 2 }} />
                      </div>
                      {h === new Date().getUTCHours() && (
                        <span style={{ fontFamily: monoFont, fontSize: 7, color: RED, letterSpacing: '0.1em' }}>◀ NOW</span>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14, padding: '8px 10px', background: 'rgba(0,200,180,0.04)', border: '1px solid rgba(0,200,180,0.1)', borderRadius: 1 }}>
                  <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>MODEL INFO</div>
                  <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.6)', lineHeight: 1.6 }}>
                    Bayesian frequency analysis<br />
                    Time-series pattern matching<br />
                    Severity trend weighting<br />
                    {data.total_analyzed} samples • 48h window
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}