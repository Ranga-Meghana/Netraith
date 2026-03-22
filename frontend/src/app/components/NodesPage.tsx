import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const font     = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';
const CYAN     = '#00FFD4';
const RED      = '#FF3A3A';
const ORANGE   = '#FF6B00';
const GREEN    = '#00FF88';
const DIM      = 'rgba(0,220,200,0.55)';

type NodeStatus = 'online' | 'compromised' | 'isolated' | 'critical' | 'insider';
type NodeType   = 'server' | 'router' | 'endpoint' | 'firewall' | 'database' | 'insider';

interface NetNode {
  id: string;
  label: string;
  type: NodeType;
  status: NodeStatus;
  ip: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: string[];
  load: number;
  lastSeen: string;
  risk: number;
}

interface Edge { from: string; to: string; active: boolean; suspicious: boolean; }

const TYPE_ICONS: Record<NodeType, string> = {
  server:   '⬡',
  router:   '◈',
  endpoint: '○',
  firewall: '⬟',
  database: '⬢',
  insider:  '⚠',
};

const STATUS_COLOR: Record<NodeStatus, string> = {
  online:      GREEN,
  compromised: RED,
  isolated:    ORANGE,
  critical:    '#FF00FF',
  insider:     ORANGE,
};

function makeNodes(): NetNode[] {
  const nodes: NetNode[] = [
    // Core infrastructure
    { id: 'fw1',  label: 'FIREWALL-01',   type: 'firewall',  status: 'online',      ip: '10.0.0.1',   x: 0, y: 0, vx: 0, vy: 0, connections: ['r1','r2'],                   load: 34, lastSeen: 'NOW',    risk: 5  },
    { id: 'r1',   label: 'ROUTER-CORE',   type: 'router',    status: 'online',      ip: '10.0.1.1',   x: 0, y: 0, vx: 0, vy: 0, connections: ['fw1','s1','s2','s3','db1'],   load: 67, lastSeen: 'NOW',    risk: 12 },
    { id: 'r2',   label: 'ROUTER-DMZ',    type: 'router',    status: 'online',      ip: '10.0.2.1',   x: 0, y: 0, vx: 0, vy: 0, connections: ['fw1','s4','ep5'],             load: 45, lastSeen: 'NOW',    risk: 8  },
    // Servers
    { id: 's1',   label: 'WEB-SRV-01',    type: 'server',    status: 'compromised', ip: '10.0.1.10',  x: 0, y: 0, vx: 0, vy: 0, connections: ['r1','ep1','ep2'],             load: 91, lastSeen: 'NOW',    risk: 88 },
    { id: 's2',   label: 'APP-SRV-01',    type: 'server',    status: 'online',      ip: '10.0.1.11',  x: 0, y: 0, vx: 0, vy: 0, connections: ['r1','ep3','db1'],             load: 55, lastSeen: 'NOW',    risk: 22 },
    { id: 's3',   label: 'AUTH-SRV-01',   type: 'server',    status: 'critical',    ip: '10.0.1.12',  x: 0, y: 0, vx: 0, vy: 0, connections: ['r1','s1','s2'],               load: 78, lastSeen: 'NOW',    risk: 95 },
    { id: 's4',   label: 'WEB-SRV-02',    type: 'server',    status: 'online',      ip: '10.0.2.10',  x: 0, y: 0, vx: 0, vy: 0, connections: ['r2','ep4'],                   load: 42, lastSeen: 'NOW',    risk: 15 },
    // Database
    { id: 'db1',  label: 'DB-PRIMARY',    type: 'database',  status: 'online',      ip: '10.0.1.20',  x: 0, y: 0, vx: 0, vy: 0, connections: ['r1','s2'],                   load: 38, lastSeen: 'NOW',    risk: 30 },
    // Endpoints
    { id: 'ep1',  label: 'WKSTN-ALICE',   type: 'endpoint',  status: 'insider',     ip: '10.0.3.11',  x: 0, y: 0, vx: 0, vy: 0, connections: ['s1'],                        load: 88, lastSeen: 'NOW',    risk: 76 },
    { id: 'ep2',  label: 'WKSTN-BOB',     type: 'endpoint',  status: 'online',      ip: '10.0.3.12',  x: 0, y: 0, vx: 0, vy: 0, connections: ['s1'],                        load: 22, lastSeen: '2m ago', risk: 10 },
    { id: 'ep3',  label: 'WKSTN-CAROL',   type: 'endpoint',  status: 'isolated',    ip: '10.0.3.13',  x: 0, y: 0, vx: 0, vy: 0, connections: ['s2'],                        load: 0,  lastSeen: '8m ago', risk: 55 },
    { id: 'ep4',  label: 'WKSTN-DAVE',    type: 'endpoint',  status: 'online',      ip: '10.0.3.14',  x: 0, y: 0, vx: 0, vy: 0, connections: ['s4'],                        load: 31, lastSeen: 'NOW',    risk: 8  },
    { id: 'ep5',  label: 'WKSTN-EVE',     type: 'endpoint',  status: 'compromised', ip: '10.0.2.11',  x: 0, y: 0, vx: 0, vy: 0, connections: ['r2'],                        load: 95, lastSeen: 'NOW',    risk: 92 },
  ];

  // Force-directed initial positions
  const W = 800, H = 500;
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const radius = 180 + Math.random() * 60;
    n.x = W/2 + Math.cos(angle) * radius;
    n.y = H/2 + Math.sin(angle) * radius;
  });

  // Center the firewall
  nodes[0].x = W/2;
  nodes[0].y = H/2 - 80;

  return nodes;
}

export function NodesPage() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animRef     = useRef(0);
  const nodesRef    = useRef<NetNode[]>(makeNodes());
  const edgesRef    = useRef<Edge[]>([]);
  const tRef        = useRef(0);
  const mouseRef    = useRef({ x: -999, y: -999 });
  const [selected,  setSelected]  = useState<NetNode | null>(null);
  const [hovered,   setHovered]   = useState<string | null>(null);
  const [insiderAlert, setInsiderAlert] = useState(true);

  // Build edges
  useEffect(() => {
    const edges: Edge[] = [];
    const seen = new Set<string>();
    nodesRef.current.forEach(n => {
      n.connections.forEach(cid => {
        const key = [n.id, cid].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          const target = nodesRef.current.find(x => x.id === cid);
          const suspicious = (n.status === 'compromised' || n.status === 'critical' || n.status === 'insider') ||
                             (target?.status === 'compromised' || target?.status === 'critical' || target?.status === 'insider') || false;
          edges.push({ from: n.id, to: cid, active: true, suspicious });
        }
      });
    });
    edgesRef.current = edges;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function getNodeAt(mx: number, my: number): NetNode | null {
      return nodesRef.current.find(n => {
        const dx = n.x - mx, dy = n.y - my;
        return Math.sqrt(dx*dx + dy*dy) < 18;
      }) || null;
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas!.width / rect.width);
      const my = (e.clientY - rect.top)  * (canvas!.height / rect.height);
      mouseRef.current = { x: mx, y: my };
      const n = getNodeAt(mx, my);
      setHovered(n?.id || null);
      canvas!.style.cursor = n ? 'pointer' : 'default';
    }

    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas!.width / rect.width);
      const my = (e.clientY - rect.top)  * (canvas!.height / rect.height);
      const n = getNodeAt(mx, my);
      setSelected(n || null);
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width, H = canvas.height;
      tRef.current += 0.016;
      const t = tRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000814';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(0,200,180,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Scale nodes to canvas
      const scaleX = W / 800, scaleY = H / 500;

      // Draw edges
      edgesRef.current.forEach(edge => {
        const from = nodesRef.current.find(n => n.id === edge.from);
        const to   = nodesRef.current.find(n => n.id === edge.to);
        if (!from || !to) return;

        const fx = from.x * scaleX, fy = from.y * scaleY;
        const tx = to.x   * scaleX, ty = to.y   * scaleY;

        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);

        if (edge.suspicious) {
          const pulse = 0.4 + 0.4 * Math.sin(t * 3);
          ctx.strokeStyle = `rgba(255,58,58,${pulse})`;
          ctx.lineWidth   = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.shadowBlur  = 6;
          ctx.shadowColor = RED;
        } else {
          ctx.strokeStyle = 'rgba(0,200,180,0.2)';
          ctx.lineWidth   = 0.8;
          ctx.setLineDash([]);
          ctx.shadowBlur  = 0;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Animated packet dot on active edges
        if (!edge.suspicious) {
          const speed  = 0.4 + (from.id.charCodeAt(0) % 5) * 0.1;
          const frac   = ((t * speed + from.id.charCodeAt(0) * 0.3) % 1);
          const px     = fx + (tx - fx) * frac;
          const py     = fy + (ty - fy) * frac;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle   = CYAN;
          ctx.shadowBlur  = 6;
          ctx.shadowColor = CYAN;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw nodes
      nodesRef.current.forEach(node => {
        const nx = node.x * scaleX, ny = node.y * scaleY;
        const isHovered  = hovered === node.id;
        const isSelected = selected?.id === node.id;
        const col = STATUS_COLOR[node.status] || GREEN;
        const r = node.type === 'firewall' ? 18 : node.type === 'router' ? 15 : node.type === 'database' ? 14 : 11;

        // Pulse ring for compromised/critical/insider
        if (node.status !== 'online') {
          const pulse = 0.3 + 0.3 * Math.sin(t * 3 + node.id.charCodeAt(0));
          ctx.beginPath();
          ctx.arc(nx, ny, r + 8 + pulse * 5, 0, Math.PI * 2);
          ctx.strokeStyle = `${col}${Math.round(pulse * 255).toString(16).padStart(2,'0')}`;
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }

        // Selection ring
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(nx, ny, r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? CYAN : 'rgba(0,255,212,0.5)';
          ctx.lineWidth   = isSelected ? 2 : 1;
          ctx.shadowBlur  = isSelected ? 15 : 8;
          ctx.shadowColor = CYAN;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Node body
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle   = `rgba(0,12,25,0.9)`;
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth   = isSelected ? 2.5 : 1.5;
        ctx.shadowBlur  = node.status !== 'online' ? 12 : 6;
        ctx.shadowColor = col;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Node icon
        ctx.fillStyle  = col;
        ctx.font       = `${r * 0.9}px monospace`;
        ctx.textAlign  = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(TYPE_ICONS[node.type], nx, ny);

        // Label
        ctx.fillStyle    = isHovered || isSelected ? col : 'rgba(150,200,200,0.6)';
        ctx.font         = `${isHovered ? 9 : 8}px ${monoFont}`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, nx, ny + r + 4);

        // Risk indicator
        if (node.risk > 50) {
          ctx.fillStyle = RED;
          ctx.font      = '7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`⚠${node.risk}%`, nx, ny - r - 2);
        }
      });

      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
      animRef.current  = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [hovered, selected]);

  const stats = {
    total:       nodesRef.current.length,
    online:      nodesRef.current.filter(n => n.status === 'online').length,
    compromised: nodesRef.current.filter(n => n.status === 'compromised').length,
    isolated:    nodesRef.current.filter(n => n.status === 'isolated').length,
    critical:    nodesRef.current.filter(n => n.status === 'critical').length,
    insider:     nodesRef.current.filter(n => n.status === 'insider').length,
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#000814', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: monoFont }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,180,0.005) 3px, rgba(0,255,180,0.005) 4px)' }} />

      {/* Header */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(0,200,180,0.15)', flexShrink: 0, zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: font, fontSize: 13, color: CYAN, letterSpacing: '0.35em', textShadow: `0 0 10px ${CYAN}` }}>NETWORK TOPOLOGY</div>
            <div style={{ fontFamily: monoFont, fontSize: 9, color: DIM, letterSpacing: '0.2em', marginTop: 2 }}>LIVE NODE MONITORING — {stats.total} NODES</div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'ONLINE',      value: stats.online,      color: GREEN  },
              { label: 'COMPROMISED', value: stats.compromised, color: RED    },
              { label: 'CRITICAL',    value: stats.critical,    color: '#FF00FF' },
              { label: 'ISOLATED',    value: stats.isolated,    color: ORANGE },
              { label: 'INSIDER',     value: stats.insider,     color: ORANGE },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: font, fontSize: 18, fontWeight: 900, color: s.color, textShadow: `0 0 10px ${s.color}` }}>{s.value}</div>
                <div style={{ fontFamily: monoFont, fontSize: 7, color: 'rgba(150,200,200,0.5)', letterSpacing: '0.15em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[
            { icon: '⬟', label: 'FIREWALL', color: GREEN   },
            { icon: '◈', label: 'ROUTER',   color: GREEN   },
            { icon: '⬡', label: 'SERVER',   color: GREEN   },
            { icon: '⬢', label: 'DATABASE', color: GREEN   },
            { icon: '○', label: 'ENDPOINT', color: GREEN   },
            { icon: '⚠', label: 'INSIDER',  color: ORANGE  },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: l.color, fontSize: 11 }}>{l.icon}</span>
              <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.5)', letterSpacing: '0.1em' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 1, background: 'rgba(0,200,180,0.4)' }} />
              <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)' }}>NORMAL LINK</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 1, background: RED, boxShadow: `0 0 4px ${RED}` }} />
              <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)' }}>SUSPICIOUS LINK</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 260px', minHeight: 0 }}>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        {/* Side panel */}
        <div style={{ borderLeft: '1px solid rgba(0,200,180,0.1)', padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2 }}>
          {/* Insider threat alert */}
          <AnimatePresence>
            {insiderAlert && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: '10px 12px', background: 'rgba(255,107,0,0.12)', border: '1px solid rgba(255,107,0,0.5)', borderRadius: 2, marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: font, fontSize: 8, color: ORANGE, letterSpacing: '0.2em' }}>⚠ INSIDER THREAT</span>
                  <button onClick={() => setInsiderAlert(false)} style={{ background: 'none', border: 'none', color: 'rgba(150,200,200,0.4)', cursor: 'pointer', fontSize: 10 }}>✕</button>
                </div>
                <div style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(255,200,150,0.9)', marginBottom: 2 }}>WKSTN-ALICE (10.0.3.11)</div>
                <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(200,150,100,0.7)' }}>Abnormal data access pattern detected. 847 file reads in 2 min.</div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6, marginBottom: 4 }}>
            {selected ? 'NODE DETAILS' : 'ALL NODES'}
          </div>

          {selected ? (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontFamily: font, fontSize: 10, color: STATUS_COLOR[selected.status] || ORANGE, textShadow: `0 0 8px ${STATUS_COLOR[selected.status] || ORANGE}` }}>{selected.label}</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
              {[
                { label: 'IP ADDRESS',  value: selected.ip },
                { label: 'TYPE',        value: selected.type.toUpperCase() },
                { label: 'STATUS',      value: selected.status.toUpperCase() },
                { label: 'CPU LOAD',    value: `${selected.load}%` },
                { label: 'RISK SCORE',  value: `${selected.risk}/100` },
                { label: 'LAST SEEN',   value: selected.lastSeen },
                { label: 'CONNECTIONS', value: selected.connections.length.toString() },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(0,200,180,0.06)' }}>
                  <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)', letterSpacing: '0.1em' }}>{row.label}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 9, color: row.label === 'STATUS' ? (STATUS_COLOR[selected.status] || ORANGE) : CYAN }}>{row.value}</span>
                </div>
              ))}
              {/* Risk bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)' }}>RISK LEVEL</span>
                  <span style={{ fontFamily: monoFont, fontSize: 8, color: selected.risk > 70 ? RED : selected.risk > 40 ? ORANGE : GREEN }}>{selected.risk}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(0,200,180,0.1)', borderRadius: 2 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${selected.risk}%` }} transition={{ duration: 0.8 }}
                    style={{ height: '100%', background: selected.risk > 70 ? RED : selected.risk > 40 ? ORANGE : GREEN, borderRadius: 2, boxShadow: `0 0 6px ${selected.risk > 70 ? RED : ORANGE}` }} />
                </div>
              </div>
              {selected.status === 'insider' && (
                <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.3)', borderRadius: 2 }}>
                  <div style={{ fontFamily: monoFont, fontSize: 8, color: ORANGE, marginBottom: 4 }}>⚠ INSIDER THREAT FLAGS</div>
                  <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(200,150,100,0.8)', lineHeight: 1.8 }}>
                    • Off-hours access (02:34 AM)<br/>
                    • 847 file reads in 2 min<br/>
                    • Unusual dest: DB-PRIMARY<br/>
                    • VPN anomaly detected
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {nodesRef.current.map(node => {
                const col = STATUS_COLOR[node.status] || GREEN;
                return (
                  <div key={node.id} onClick={() => setSelected(node)}
                    style={{ padding: '6px 10px', background: 'rgba(0,12,25,0.5)', border: `1px solid ${col}20`, borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${col}10`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,12,25,0.5)')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, boxShadow: `0 0 5px ${col}` }} />
                        <span style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(200,230,230,0.8)' }}>{node.label}</span>
                      </div>
                      <span style={{ fontFamily: monoFont, fontSize: 8, color: col, textTransform: 'uppercase' }}>{node.status}</span>
                    </div>
                    <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)', marginTop: 2 }}>{node.ip}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}