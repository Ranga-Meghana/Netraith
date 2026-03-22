// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

export function GlobeScene({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => onComplete(), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    // City nodes on globe (lat, lon in degrees)
    const cities = [
      { lat: 40.7, lon: -74, label: 'NEW YORK' },
      { lat: 51.5, lon: 0, label: 'LONDON' },
      { lat: 35.7, lon: 139.7, label: 'TOKYO' },
      { lat: -23.5, lon: -46.6, label: 'SÃO PAULO' },
      { lat: 28.6, lon: 77.2, label: 'DELHI' },
      { lat: 31.2, lon: 121.5, label: 'SHANGHAI' },
      { lat: 48.8, lon: 2.3, label: 'PARIS' },
      { lat: -33.9, lon: 151.2, label: 'SYDNEY' },
      { lat: 55.7, lon: 37.6, label: 'MOSCOW' },
      { lat: 1.3, lon: 103.8, label: 'SINGAPORE' },
    ];

    // Attack arcs
    type Arc = { from: number; to: number; progress: number; speed: number; color: string; active: boolean };
    const arcs: Arc[] = [];
    function spawnArc() {
      const from = Math.floor(Math.random() * cities.length);
      let to = Math.floor(Math.random() * cities.length);
      while (to === from) to = Math.floor(Math.random() * cities.length);
      const isAttack = Math.random() < 0.4;
      arcs.push({ from, to, progress: 0, speed: 0.004 + Math.random() * 0.006, color: isAttack ? '#FF4444' : '#00FFD4', active: true });
    }
    for (let i = 0; i < 6; i++) spawnArc();

    type Pulse = { lat: number; lon: number; radius: number; alpha: number };
    const pulses: Pulse[] = [];
    cities.forEach(c => {
      if (Math.random() < 0.4) pulses.push({ lat: c.lat, lon: c.lon, radius: 0, alpha: 1 });
    });

    function latLonToXY(lat: number, lon: number, cx: number, cy: number, r: number, rotY: number) {
      const φ = (lat * Math.PI) / 180;
      const λ = (lon * Math.PI) / 180 + rotY;
      const x = r * Math.cos(φ) * Math.sin(λ);
      const y = -r * Math.sin(φ);
      const z = r * Math.cos(φ) * Math.cos(λ);
      return { sx: cx + x, sy: cy + y, z, visible: z > -r * 0.1 };
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);

      // Bg
      const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.7);
      bg.addColorStop(0, '#000d1a');
      bg.addColorStop(1, '#000005');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const radius = Math.min(W, H) * 0.32;
      const rotY = t * 0.15;

      // Globe glow
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.4);
      glow.addColorStop(0, 'rgba(0,60,100,0.0)');
      glow.addColorStop(0.7, 'rgba(0,80,120,0.15)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Globe base
      const globeGrad = ctx.createRadialGradient(cx - radius*0.3, cy - radius*0.2, 0, cx, cy, radius);
      globeGrad.addColorStop(0, '#0a2040');
      globeGrad.addColorStop(0.5, '#041525');
      globeGrad.addColorStop(1, '#010a15');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = globeGrad;
      ctx.fill();

      // Globe outline glow
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,200,180,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,200,180,0.1)';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Lat lines
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      for (let lat = -60; lat <= 60; lat += 30) {
        const φ = (lat * Math.PI) / 180;
        const r2 = radius * Math.cos(φ);
        const yOff = -radius * Math.sin(φ);
        ctx.beginPath();
        ctx.ellipse(cx, cy + yOff, r2, r2 * 0.15, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,180,160,0.15)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      // Lon lines
      for (let lon = 0; lon < 360; lon += 30) {
        const λ = ((lon + rotY * 180 / Math.PI) * Math.PI) / 180;
        const xTilt = Math.cos(λ) * radius;
        ctx.beginPath();
        ctx.ellipse(cx + xTilt * 0, cy, Math.abs(Math.sin(λ) * radius), radius, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,180,160,0.12)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();

      // Arcs
      arcs.forEach(arc => {
        arc.progress += arc.speed;
        if (arc.progress > 1) {
          arc.progress = 0;
          const from = Math.floor(Math.random() * cities.length);
          let to = Math.floor(Math.random() * cities.length);
          while (to === from) to = Math.floor(Math.random() * cities.length);
          arc.from = from;
          arc.to = to;
          const isAttack = Math.random() < 0.4;
          arc.color = isAttack ? '#FF4444' : '#00FFD4';
        }
        const c1 = latLonToXY(cities[arc.from].lat, cities[arc.from].lon, cx, cy, radius, rotY);
        const c2 = latLonToXY(cities[arc.to].lat, cities[arc.to].lon, cx, cy, radius, rotY);
        if (!c1.visible && !c2.visible) return;

        // Draw partial arc
        const steps = 40;
        const drawn = Math.floor(arc.progress * steps);
        ctx.beginPath();
        for (let i = 0; i <= drawn; i++) {
          const frac = i / steps;
          const interLat = cities[arc.from].lat + (cities[arc.to].lat - cities[arc.from].lat) * frac;
          const interLon = cities[arc.from].lon + (cities[arc.to].lon - cities[arc.from].lon) * frac;
          const arcHeight = Math.sin(frac * Math.PI) * radius * 0.3;
          const p = latLonToXY(interLat, interLon, cx, cy, radius + arcHeight, rotY);
          if (i === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.strokeStyle = arc.color === '#FF4444'
          ? `rgba(255,68,68,${0.6 * arc.progress})`
          : `rgba(0,255,212,${0.5 * arc.progress})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Leading dot
        if (drawn > 0) {
          const frac = drawn / steps;
          const interLat = cities[arc.from].lat + (cities[arc.to].lat - cities[arc.from].lat) * frac;
          const interLon = cities[arc.from].lon + (cities[arc.to].lon - cities[arc.from].lon) * frac;
          const arcH = Math.sin(frac * Math.PI) * radius * 0.3;
          const p = latLonToXY(interLat, interLon, cx, cy, radius + arcH, rotY);
          ctx.shadowBlur = arc.color === '#FF4444' ? 12 : 8;
          ctx.shadowColor = arc.color;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = arc.color;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // City nodes
      cities.forEach(city => {
        const p = latLonToXY(city.lat, city.lon, cx, cy, radius, rotY);
        if (!p.visible) return;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00FFD4';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00FFD4';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 6 + 3 * Math.sin(t * 2 + city.lat), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,255,212,0.3)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      // Attack pulses
      pulses.forEach(pulse => {
        const p = latLonToXY(pulse.lat, pulse.lon, cx, cy, radius, rotY);
        if (!p.visible) return;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, pulse.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,80,80,${pulse.alpha})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        pulse.radius += 0.5;
        pulse.alpha -= 0.008;
        if (pulse.alpha <= 0) { pulse.radius = 0; pulse.alpha = 0.9; }
      });

      // Digital grid overlay on globe
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = `rgba(0,100,80,${0.02 + 0.01 * Math.sin(t)})`;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();

      // Scan line effect
      const scanY = ((t * 80) % (radius * 2)) - radius;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      const scanGrad = ctx.createLinearGradient(cx, cy + scanY - 20, cx, cy + scanY + 20);
      scanGrad.addColorStop(0, 'transparent');
      scanGrad.addColorStop(0.5, 'rgba(0,255,180,0.06)');
      scanGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(cx - radius, cy + scanY - 20, radius * 2, 40);
      ctx.restore();
    }

    function animate() {
      t += 0.016;
      draw();
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const monoFont = '"Share Tech Mono", monospace';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 1 }}
        style={{
          position: 'absolute', bottom: 60, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap',
          padding: '0 40px',
        }}
      >
        {[
          { label: 'ACTIVE THREATS', value: '247', color: '#FF4444' },
          { label: 'NODES MONITORED', value: '12,847', color: '#00FFD4' },
          { label: 'ATTACKS BLOCKED', value: '1,893', color: '#00FFD4' },
          { label: 'THREAT LEVEL', value: 'CRITICAL', color: '#FF6600' },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
            style={{
              padding: '10px 20px',
              background: 'rgba(0,10,20,0.7)',
              border: `1px solid ${item.color}40`,
              backdropFilter: 'blur(10px)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: monoFont, fontSize: 10, color: 'rgba(150,200,200,0.6)', letterSpacing: '0.2em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 18, color: item.color, fontWeight: 700, textShadow: `0 0 10px ${item.color}` }}>{item.value}</div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 1, delay: 0.5 }}
        style={{
          position: 'absolute', top: 40, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}
      >
        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 'clamp(11px, 1.5vw, 14px)', color: 'rgba(0,220,200,0.6)', letterSpacing: '0.35em', textTransform: 'uppercase' }}>
          GLOBAL THREAT MONITORING — ACTIVE
        </div>
      </motion.div>

      {/* Scan lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,180,0.012) 3px, rgba(0,255,180,0.012) 4px)',
      }} />
    </div>
  );
}
