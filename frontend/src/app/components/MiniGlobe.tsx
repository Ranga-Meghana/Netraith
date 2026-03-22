// @ts-nocheck
import { useEffect, useRef } from 'react';

export function MiniGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const cities = [
      { lat: 40.7, lon: -74 },
      { lat: 51.5, lon: 0 },
      { lat: 35.7, lon: 139.7 },
      { lat: -23.5, lon: -46.6 },
      { lat: 28.6, lon: 77.2 },
      { lat: 31.2, lon: 121.5 },
      { lat: 1.3, lon: 103.8 },
    ];

    type Arc = { from: number; to: number; progress: number; speed: number; isAttack: boolean };
    const arcs: Arc[] = [];
    for (let i = 0; i < 4; i++) {
      arcs.push({
        from: Math.floor(Math.random() * cities.length),
        to: Math.floor(Math.random() * cities.length),
        progress: Math.random(),
        speed: 0.006 + Math.random() * 0.008,
        isAttack: Math.random() < 0.35,
      });
    }

    function latLonToXY(lat: number, lon: number, cx: number, cy: number, r: number, rotY: number) {
      const φ = (lat * Math.PI) / 180;
      const λ = (lon * Math.PI) / 180 + rotY;
      const x = r * Math.cos(φ) * Math.sin(λ);
      const y = -r * Math.sin(φ);
      const z = r * Math.cos(φ) * Math.cos(λ);
      return { sx: cx + x, sy: cy + y, z, visible: z > -r * 0.05 };
    }

    let prevW = 0, prevH = 0;

    function draw() {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (W !== prevW || H !== prevH) {
        canvas.width = W;
        canvas.height = H;
        prevW = W;
        prevH = H;
      }

      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) * 0.4;
      const rotY = t * 0.3;

      // Globe base
      const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.2, 0, cx, cy, r);
      grad.addColorStop(0, '#081a30');
      grad.addColorStop(1, '#020c18');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,200,180,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Lat lines
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      for (let lat = -60; lat <= 60; lat += 30) {
        const φ = (lat * Math.PI) / 180;
        const r2 = r * Math.cos(φ);
        const yOff = -r * Math.sin(φ);
        ctx.beginPath();
        ctx.ellipse(cx, cy + yOff, r2, r2 * 0.15, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,180,160,0.18)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      ctx.restore();

      // Arcs
      arcs.forEach(arc => {
        arc.progress += arc.speed;
        if (arc.progress > 1) {
          arc.progress = 0;
          arc.from = Math.floor(Math.random() * cities.length);
          let to = Math.floor(Math.random() * cities.length);
          while (to === arc.from) to = Math.floor(Math.random() * cities.length);
          arc.to = to;
          arc.isAttack = Math.random() < 0.35;
        }
        const steps = 30;
        const drawn = Math.floor(arc.progress * steps);
        ctx.beginPath();
        for (let i = 0; i <= drawn; i++) {
          const frac = i / steps;
          const iLat = cities[arc.from].lat + (cities[arc.to].lat - cities[arc.from].lat) * frac;
          const iLon = cities[arc.from].lon + (cities[arc.to].lon - cities[arc.from].lon) * frac;
          const aH = Math.sin(frac * Math.PI) * r * 0.3;
          const p = latLonToXY(iLat, iLon, cx, cy, r + aH, rotY);
          if (i === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.strokeStyle = arc.isAttack ? `rgba(255,60,60,${0.5 * arc.progress})` : `rgba(0,255,210,${0.4 * arc.progress})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      // Cities
      cities.forEach(c => {
        const p = latLonToXY(c.lat, c.lon, cx, cy, r, rotY);
        if (!p.visible) return;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00FFD4';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#00FFD4';
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Scan line
      const scanY = ((t * 50) % (r * 2)) - r;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const sg = ctx.createLinearGradient(cx, cy + scanY - 10, cx, cy + scanY + 10);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(0.5, 'rgba(0,255,180,0.08)');
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.fillRect(cx - r, cy + scanY - 10, r * 2, 20);
      ctx.restore();
    }

    function animate() {
      t += 0.016;
      draw();
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
