// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

export function SpaceScene({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const t3 = setTimeout(() => setPhase(3), 2800);
    const t4 = setTimeout(() => onComplete(), 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    type Star = { x: number; y: number; size: number; brightness: number; speed: number; color: string };
    const stars: Star[] = [];
    type Particle = { x: number; y: number; vx: number; vy: number; alpha: number; size: number };
    const particles: Particle[] = [];

    function initStars(w: number, h: number) {
      stars.length = 0;
      for (let i = 0; i < 350; i++) {
        const r = Math.random();
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: r < 0.6 ? Math.random() * 1.2 + 0.2 : Math.random() * 2.5 + 1,
          brightness: Math.random() * 0.6 + 0.4,
          speed: Math.random() * 0.8 + 0.2,
          color: r < 0.7 ? '200,230,255' : r < 0.85 ? '180,210,255' : '220,200,255',
        });
      }
      particles.length = 0;
      for (let i = 0; i < 80; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          alpha: Math.random() * 0.4,
          size: Math.random() * 1.5,
        });
      }
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars(canvas.width, canvas.height);
    }

    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);

      // Deep space bg
      const bg = ctx.createRadialGradient(W * 0.45, H * 0.45, 0, W * 0.45, H * 0.45, W * 0.9);
      bg.addColorStop(0, '#000d1f');
      bg.addColorStop(0.5, '#000810');
      bg.addColorStop(1, '#000005');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebula 1 — blue-teal
      const nb1 = ctx.createRadialGradient(W * 0.25, H * 0.35, 0, W * 0.25, H * 0.35, W * 0.45);
      nb1.addColorStop(0, 'rgba(0,100,160,0.18)');
      nb1.addColorStop(0.5, 'rgba(0,60,100,0.08)');
      nb1.addColorStop(1, 'transparent');
      ctx.fillStyle = nb1;
      ctx.fillRect(0, 0, W, H);

      // Nebula 2 — violet
      const nb2 = ctx.createRadialGradient(W * 0.75, H * 0.6, 0, W * 0.75, H * 0.6, W * 0.4);
      nb2.addColorStop(0, 'rgba(60,0,100,0.14)');
      nb2.addColorStop(1, 'transparent');
      ctx.fillStyle = nb2;
      ctx.fillRect(0, 0, W, H);

      // Nebula 3 — cyan hint near center
      const nb3 = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.3);
      nb3.addColorStop(0, `rgba(0,200,180,${0.04 + 0.03 * Math.sin(t * 0.3)})`);
      nb3.addColorStop(1, 'transparent');
      ctx.fillStyle = nb3;
      ctx.fillRect(0, 0, W, H);

      // Stars
      stars.forEach(s => {
        const tw = 0.5 + 0.5 * Math.sin(t * s.speed * 2 + s.brightness * 12);
        const a = (0.3 + 0.7 * tw) * s.brightness;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color},${a})`;
        ctx.fill();
        if (s.size > 1.8) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(${s.color},0.8)`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Floating particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,220,200,${p.alpha * (0.5 + 0.5 * Math.sin(t * 0.5 + p.x))})`;
        ctx.fill();
      });
    }

    function animate() {
      t += 0.016;
      draw();
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const font = 'Orbitron, monospace';
  const monoFont = '"Share Tech Mono", monospace';

  const letters = 'NETRAITH'.split('');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>

        {/* Logo SVG */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3, rotate: -30 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1 : 0.3, rotate: phase >= 1 ? 0 : -30 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 28, filter: 'drop-shadow(0 0 20px rgba(0,255,212,0.6))' }}
        >
          <svg width="90" height="90" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="sg">
                <feGaussianBlur stdDeviation="1.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <polygon points="40,4 73,22 73,58 40,76 7,58 7,22" stroke="#00FFD4" strokeWidth="1.5" opacity="0.9" filter="url(#sg)" />
            <polygon points="40,16 62,28 62,52 40,64 18,52 18,28" stroke="#00D4FF" strokeWidth="0.8" opacity="0.5" />
            <line x1="40" y1="4" x2="40" y2="76" stroke="#00FFD4" strokeWidth="0.5" opacity="0.3"/>
            <line x1="7" y1="40" x2="73" y2="40" stroke="#00FFD4" strokeWidth="0.5" opacity="0.3"/>
            <line x1="7" y1="22" x2="73" y2="58" stroke="#00D4FF" strokeWidth="0.4" opacity="0.2"/>
            <line x1="73" y1="22" x2="7" y2="58" stroke="#00D4FF" strokeWidth="0.4" opacity="0.2"/>
            {[{x:40,y:4},{x:73,y:22},{x:73,y:58},{x:40,y:76},{x:7,y:58},{x:7,y:22}].map((n,i) => (
              <circle key={i} cx={n.x} cy={n.y} r="3" fill="#00FFD4" filter="url(#sg)" opacity="0.9"/>
            ))}
            <circle cx="40" cy="40" r="8" fill="none" stroke="#00FFD4" strokeWidth="1.2" opacity="0.8"/>
            <circle cx="40" cy="40" r="4" fill="#00FFD4" opacity="0.9" filter="url(#sg)"/>
            <circle cx="40" cy="40" r="2" fill="white" opacity="0.95"/>
            {[{x:40,y:4},{x:73,y:22},{x:73,y:58},{x:40,y:76},{x:7,y:58},{x:7,y:22}].map((n,i) => (
              <line key={i} x1="40" y1="40" x2={n.x} y2={n.y} stroke="#00D4FF" strokeWidth="0.6" opacity="0.35"/>
            ))}
          </svg>
        </motion.div>

        {/* NETRAITH letter-by-letter */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: 14 }}>
          {letters.map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
              animate={{
                opacity: phase >= 1 ? 1 : 0,
                y: phase >= 1 ? 0 : 30,
                filter: phase >= 1 ? 'blur(0px)' : 'blur(8px)'
              }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.1, ease: 'easeOut' }}
              style={{
                fontFamily: font,
                fontSize: 'clamp(32px, 5.5vw, 68px)',
                fontWeight: 900,
                color: '#00FFD4',
                textShadow: '0 0 20px rgba(0,255,212,0.9), 0 0 50px rgba(0,255,212,0.5), 0 0 80px rgba(0,200,180,0.3)',
                letterSpacing: '0.05em',
                display: 'inline-block',
              }}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.6em' }}
          animate={{ opacity: phase >= 2 ? 1 : 0, letterSpacing: phase >= 2 ? '0.38em' : '0.6em' }}
          transition={{ duration: 1 }}
          style={{
            fontFamily: monoFont,
            fontSize: 'clamp(10px, 1.4vw, 15px)',
            color: 'rgba(0,220,200,0.75)',
            letterSpacing: '0.38em',
            textTransform: 'uppercase',
            marginBottom: 36,
          }}
        >
          CYBER DEFENSE PLATFORM
        </motion.p>

        {/* Status bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 3 ? 1 : 0 }}
          transition={{ duration: 0.8 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: '#00FFD4', boxShadow: '0 0 8px #00FFD4' }}
          />
          <span style={{ fontFamily: monoFont, fontSize: 11, color: 'rgba(0,200,180,0.6)', letterSpacing: '0.3em' }}>
            INITIALIZING THREAT MATRIX...
          </span>
        </motion.div>

        {/* Scan lines effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 2 ? 0.04 : 0 }}
          transition={{ duration: 1 }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,1) 2px, rgba(0,255,200,1) 3px)',
          }}
        />
      </div>
    </div>
  );
}
