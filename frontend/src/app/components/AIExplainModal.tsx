import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const font     = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';
const CYAN     = '#00FFD4';
const RED      = '#FF3A3A';
const ORANGE   = '#FF6B00';
const MAGENTA  = '#FF00FF';
const DIM      = 'rgba(0,220,200,0.55)';

interface Props {
  alert: any;
  onClose: () => void;
}

function parseExplanation(text: string) {
  const sections: { label: string; content: string; color: string }[] = [];
  const patterns = [
    { key: '**ATTACK TYPE:**',     color: RED    },
    { key: '**HOW IT WORKS:**',    color: CYAN   },
    { key: '**RISK LEVEL:**',      color: ORANGE },
    { key: '**IMMEDIATE ACTION:**',color: '#FFD700' },
    { key: '**INVESTIGATION:**',   color: '#00FF88' },
  ];
  let remaining = text;
  patterns.forEach((p, i) => {
    const start = remaining.indexOf(p.key);
    if (start === -1) return;
    const after   = remaining.slice(start + p.key.length);
    const nextKey = patterns[i + 1]?.key;
    const end     = nextKey ? after.indexOf(nextKey) : after.length;
    const content = after.slice(0, end === -1 ? after.length : end).trim();
    sections.push({ label: p.key.replace(/\*\*/g, ''), content, color: p.color });
  });
  return sections.length > 0 ? sections : [{ label: 'ANALYSIS', content: text, color: CYAN }];
}

export function AIExplainModal({ alert, onClose }: Props) {
  const [explanation, setExplanation] = useState<string>('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [fetched,     setFetched]     = useState(false);

  async function fetchExplanation() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('${import.meta.env.VITE_API_URL}/api/ai/explain', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ alert }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setExplanation(data.explanation);
      setFetched(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const sevColor = alert.severity === 'critical' ? RED
                 : alert.severity === 'high'     ? ORANGE
                 : CYAN;

  const sections = explanation ? parseExplanation(explanation) : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,10,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 20 }}
        onClick={e => e.stopPropagation()}
        style={{ width: 680, maxHeight: '85vh', background: 'rgba(0,8,20,0.98)', border: `1px solid ${sevColor}40`, borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: `0 0 60px ${sevColor}20` }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${sevColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${sevColor}08`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <div>
              <div style={{ fontFamily: font, fontSize: 11, color: CYAN, letterSpacing: '0.3em', textShadow: `0 0 8px ${CYAN}` }}>AI THREAT ANALYSIS</div>
              <div style={{ fontFamily: monoFont, fontSize: 8, color: DIM, letterSpacing: '0.15em', marginTop: 2 }}>POWERED BY CLAUDE — NETRAITH INTELLIGENCE</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(0,200,180,0.2)', color: 'rgba(150,200,200,0.6)', fontFamily: monoFont, fontSize: 9, padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.1em' }}>✕ CLOSE</button>
        </div>

        {/* Alert info bar */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(0,200,180,0.1)', display: 'flex', gap: 20, flexShrink: 0, background: 'rgba(0,5,15,0.5)' }}>
          {[
            { label: 'SIGNATURE', value: alert.signature, color: 'rgba(200,230,230,0.8)' },
            { label: 'SEVERITY',  value: alert.severity?.toUpperCase(), color: sevColor },
            { label: 'SRC IP',    value: alert.src_ip || alert.srcIp, color: sevColor },
            { label: 'PROTO',     value: alert.proto, color: CYAN },
          ].map(f => (
            <div key={f.label} style={{ flex: f.label === 'SIGNATURE' ? 2 : 1, minWidth: 0 }}>
              <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.15em', marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontFamily: monoFont, fontSize: 9, color: f.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {!fetched && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 16 }}>
              <div style={{ fontFamily: monoFont, fontSize: 10, color: 'rgba(150,200,200,0.5)', letterSpacing: '0.2em', textAlign: 'center' }}>
                Click below to get an AI-powered explanation<br />of this threat from Claude.
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={fetchExplanation}
                style={{ padding: '12px 32px', background: `${CYAN}15`, border: `1px solid ${CYAN}60`, color: CYAN, fontFamily: font, fontSize: 10, letterSpacing: '0.25em', cursor: 'pointer', borderRadius: 2, textShadow: `0 0 8px ${CYAN}` }}
              >
                🤖 ANALYZE WITH AI
              </motion.button>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ width: 36, height: 36, border: `2px solid ${CYAN}30`, borderTop: `2px solid ${CYAN}`, borderRadius: '50%' }}
              />
              <div style={{ fontFamily: monoFont, fontSize: 9, color: DIM, letterSpacing: '0.2em' }}>CLAUDE IS ANALYZING...</div>
              {['Parsing Suricata signature...', 'Assessing threat vectors...', 'Generating remediation steps...'].map((msg, i) => (
                <motion.div key={msg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.8 }}
                  style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(0,200,180,0.4)', letterSpacing: '0.1em' }}>
                  ✓ {msg}
                </motion.div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ padding: 16, background: `${RED}10`, border: `1px solid ${RED}30`, borderRadius: 2, fontFamily: monoFont, fontSize: 9, color: RED }}>
              ⚠ Error: {error}
              <br /><br />
              <span style={{ color: 'rgba(200,150,150,0.6)', fontSize: 8 }}>Make sure ANTHROPIC_API_KEY is set in your backend environment.</span>
            </div>
          )}

          {fetched && sections.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sections.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  style={{ padding: '12px 14px', background: `${s.color}08`, border: `1px solid ${s.color}25`, borderRadius: 2, borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontFamily: font, fontSize: 8, color: s.color, letterSpacing: '0.2em', marginBottom: 8, textShadow: `0 0 6px ${s.color}` }}>{s.label}</div>
                  <div style={{ fontFamily: monoFont, fontSize: 10, color: 'rgba(200,230,230,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.content}</div>
                </motion.div>
              ))}
              <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.3)', textAlign: 'center', paddingTop: 8, borderTop: '1px solid rgba(0,200,180,0.08)' }}>
                Analysis cached • Generated by Claude Sonnet • Netraith AI Intelligence
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        {fetched && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(0,200,180,0.1)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={fetchExplanation} style={{ padding: '5px 14px', background: 'transparent', border: '1px solid rgba(0,200,180,0.2)', color: DIM, fontFamily: monoFont, fontSize: 8, cursor: 'pointer', letterSpacing: '0.1em' }}>↻ REGENERATE</button>
            <button onClick={() => navigator.clipboard.writeText(explanation)} style={{ padding: '5px 14px', background: 'transparent', border: '1px solid rgba(0,200,180,0.2)', color: DIM, fontFamily: monoFont, fontSize: 8, cursor: 'pointer', letterSpacing: '0.1em' }}>⎘ COPY</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}