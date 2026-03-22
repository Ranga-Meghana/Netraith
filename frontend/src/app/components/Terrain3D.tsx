// @ts-nocheck
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface Terrain3DHandle {
  triggerThreat: (col: number, row: number) => void;
}

interface Props {
  className?: string;
}

export const Terrain3D = forwardRef<Terrain3DHandle, Props>(({ className }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threatRef = useRef<{ col: number; row: number; intensity: number; age: number }[]>([]);

  useImperativeHandle(ref, () => ({
    triggerThreat: (col, row) => {
      threatRef.current.push({ col, row, intensity: 1, age: 0 });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const COLS = 58;
    const ROWS = 34;
    const SPACING = 22;
    const FOCAL = 420;
    const CAM_HEIGHT = 190;
    const DEPTH_OFFSET = 480;

    function getHeight(col: number, row: number, time: number): number {
      const nx = (col / COLS) * 10 - 5;
      const ny = (row / ROWS) * 8 - 1;

      // Main mountain ridge
      const ridgeX = nx * 0.6;
      const ridgeZ = Math.exp(-(ridgeX * ridgeX) * 0.5) * 80;

      // Secondary bumps
      const bump1 = Math.exp(-((nx - 1.5) ** 2 + (ny - 3) ** 2) * 0.3) * 40;
      const bump2 = Math.exp(-((nx + 2) ** 2 + (ny - 5) ** 2) * 0.2) * 35;

      // Animated waves
      const wave =
        Math.sin(nx * 1.2 + time * 0.35) * 12 +
        Math.sin(ny * 1.5 - time * 0.25) * 10 +
        Math.sin((nx + ny) * 0.9 + time * 0.18) * 14 +
        Math.cos(nx * 0.7 - ny * 1.1 + time * 0.22) * 8;

      // Threat spikes
      let threat = 0;
      threatRef.current.forEach(th => {
        const dx = col - th.col;
        const dy = row - th.row;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const spike = Math.exp(-dist * 0.8) * 60 * th.intensity * Math.max(0, 1 - th.age / 80);
        threat += spike;
      });

      return ridgeZ + bump1 + bump2 + wave + threat;
    }

    function project(wx: number, wy: number, wz: number, cw: number, ch: number) {
      const relY = wy + DEPTH_OFFSET;
      const relZ = wz - CAM_HEIGHT;
      if (relY <= 0) return null;
      const scale = FOCAL / relY;
      return {
        sx: cw * 0.5 + wx * scale,
        sy: ch * 0.66 + relZ * scale,
        scale,
        depth: relY,
      };
    }

    type RGB = { r: number; g: number; b: number };

    function getColor(height: number): RGB {
      // Deep: dark navy blue
      // Mid: teal
      // Peak: bright cyan/white-cyan
      const norm = Math.max(0, Math.min(1, (height + 10) / 110));

      if (norm < 0.25) {
        const s = norm / 0.25;
        return { r: 0, g: Math.floor(40 + s * 80), b: Math.floor(60 + s * 80) };
      } else if (norm < 0.6) {
        const s = (norm - 0.25) / 0.35;
        return { r: 0, g: Math.floor(120 + s * 120), b: Math.floor(140 + s * 80) };
      } else {
        const s = (norm - 0.6) / 0.4;
        return { r: Math.floor(s * 80), g: Math.floor(240 + s * 15), b: Math.floor(220 + s * 35) };
      }
    }

    function getThreatColor(height: number, threatBoost: number): RGB {
      if (threatBoost > 5) {
        const s = Math.min(1, threatBoost / 40);
        const base = getColor(height);
        return {
          r: Math.floor(base.r + (255 - base.r) * s * 0.9),
          g: Math.floor(base.g * (1 - s * 0.8)),
          b: Math.floor(base.b * (1 - s * 0.5)),
        };
      }
      return getColor(height);
    }

    let prevWidth = 0;
    let prevHeight = 0;

    function draw() {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      if (cw !== prevWidth || ch !== prevHeight) {
        canvas.width = cw;
        canvas.height = ch;
        prevWidth = cw;
        prevHeight = ch;
      }

      ctx.clearRect(0, 0, cw, ch);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, ch);
      bg.addColorStop(0, '#000814');
      bg.addColorStop(0.5, '#000d1e');
      bg.addColorStop(1, '#000508');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);

      // Horizon glow
      const horizonGrad = ctx.createRadialGradient(cw / 2, ch * 0.5, 0, cw / 2, ch * 0.5, cw * 0.6);
      horizonGrad.addColorStop(0, 'rgba(0,80,100,0.0)');
      horizonGrad.addColorStop(0.5, 'rgba(0,60,80,0.12)');
      horizonGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, 0, cw, ch);

      // Cache heights
      const heights: number[][] = [];
      for (let row = 0; row < ROWS; row++) {
        heights[row] = [];
        for (let col = 0; col < COLS; col++) {
          heights[row][col] = getHeight(col, row, t);
        }
      }

      // Update threats
      threatRef.current.forEach(th => { th.age += 1; });
      threatRef.current = threatRef.current.filter(th => th.age < 120);

      // Draw back to front
      for (let row = ROWS - 1; row >= 0; row--) {
        for (let col = 0; col < COLS; col++) {
          const wx = (col - COLS / 2) * SPACING;
          const wy = row * SPACING;
          const wz = heights[row][col];

          const p = project(wx, wy, wz, cw, ch);
          if (!p) continue;

          const distFade = Math.min(1, p.scale * 2.2);
          const heightFade = Math.max(0.2, wz / 100);

          // Compute threat boost for coloring
          let threatBoost = 0;
          threatRef.current.forEach(th => {
            const dx = col - th.col;
            const dy = row - th.row;
            const dist = Math.sqrt(dx * dx + dy * dy);
            threatBoost += Math.exp(-dist * 0.8) * 60 * th.intensity * Math.max(0, 1 - th.age / 80);
          });

          const c = getThreatColor(wz - threatBoost, threatBoost);

          // Right edge line (to col+1)
          if (col < COLS - 1) {
            const wx2 = (col + 1 - COLS / 2) * SPACING;
            const wz2 = heights[row][col + 1];
            const p2 = project(wx2, wy, wz2, cw, ch);
            if (p2) {
              const alpha = distFade * (0.25 + heightFade * 0.55) * Math.min(1, p.scale * 1.8);
              ctx.beginPath();
              ctx.moveTo(p.sx, p.sy);
              ctx.lineTo(p2.sx, p2.sy);
              ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${Math.min(1, alpha)})`;
              ctx.lineWidth = Math.max(0.3, p.scale * 0.9);
              ctx.stroke();
            }
          }

          // Down edge line (to row-1 = closer)
          if (row > 0) {
            const wy2 = (row - 1) * SPACING;
            const wz2 = heights[row - 1][col];
            const p2 = project(wx, wy2, wz2, cw, ch);
            if (p2) {
              const alpha = distFade * (0.25 + heightFade * 0.55) * Math.min(1, p.scale * 1.8);
              ctx.beginPath();
              ctx.moveTo(p.sx, p.sy);
              ctx.lineTo(p2.sx, p2.sy);
              ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${Math.min(1, alpha)})`;
              ctx.lineWidth = Math.max(0.3, p.scale * 0.9);
              ctx.stroke();
            }
          }

          // Vertex dot
          const dotAlpha = distFade * Math.min(1, p.scale * 3);
          const dotSize = Math.max(0.5, p.scale * (wz > 55 ? 2.2 : 1.2));

          if (wz > 60 || threatBoost > 10) {
            const glowColor = threatBoost > 10 ? `rgba(255,80,80,0.7)` : `rgba(0,255,210,0.6)`;
            ctx.shadowBlur = threatBoost > 10 ? 14 : 8;
            ctx.shadowColor = glowColor;
          }

          ctx.beginPath();
          ctx.arc(p.sx, p.sy, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${dotAlpha})`;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Extra glow dot for peaks
          if (wz > 70) {
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, dotSize * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${dotAlpha * 0.3})`;
            ctx.fill();
          }
        }
      }

      // Fog/fade at the far end (top of terrain)
      const fogGrad = ctx.createLinearGradient(0, 0, 0, ch * 0.5);
      fogGrad.addColorStop(0, 'rgba(0,8,20,0.95)');
      fogGrad.addColorStop(0.5, 'rgba(0,8,20,0.3)');
      fogGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, cw, ch);

      // Bottom fade
      const bottomFog = ctx.createLinearGradient(0, ch * 0.75, 0, ch);
      bottomFog.addColorStop(0, 'transparent');
      bottomFog.addColorStop(1, 'rgba(0,6,14,0.98)');
      ctx.fillStyle = bottomFog;
      ctx.fillRect(0, 0, cw, ch);

      // Left/right fade
      const leftFog = ctx.createLinearGradient(0, 0, cw * 0.15, 0);
      leftFog.addColorStop(0, 'rgba(0,6,14,0.9)');
      leftFog.addColorStop(1, 'transparent');
      ctx.fillStyle = leftFog;
      ctx.fillRect(0, 0, cw, ch);
      const rightFog = ctx.createLinearGradient(cw * 0.85, 0, cw, 0);
      rightFog.addColorStop(0, 'transparent');
      rightFog.addColorStop(1, 'rgba(0,6,14,0.9)');
      ctx.fillStyle = rightFog;
      ctx.fillRect(0, 0, cw, ch);
    }

    function animate() {
      t += 0.012;
      draw();
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
});

Terrain3D.displayName = 'Terrain3D';
