import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlertsStore } from '../store/alertsStore';

const font     = 'Orbitron, monospace';
const monoFont = '"Share Tech Mono", monospace';
const CYAN     = '#00FFD4';
const RED      = '#FF3A3A';
const ORANGE   = '#FF6B00';
const DIM      = 'rgba(0,220,200,0.55)';

function ipToGeo(ip: string): { lat: number; lon: number; country: string } {
  const first = parseInt(ip.split('.')[0]) || 0;
  if (first >= 1   && first <= 50)  return { lat: 37.0,  lon: -95.7,  country: 'United States' };
  if (first >= 51  && first <= 80)  return { lat: 51.5,  lon: -0.1,   country: 'United Kingdom' };
  if (first >= 81  && first <= 100) return { lat: 52.5,  lon: 13.4,   country: 'Germany' };
  if (first >= 101 && first <= 120) return { lat: 48.8,  lon: 2.3,    country: 'France' };
  if (first >= 121 && first <= 140) return { lat: 35.7,  lon: 139.7,  country: 'Japan' };
  if (first >= 141 && first <= 160) return { lat: 39.9,  lon: 116.4,  country: 'China' };
  if (first >= 161 && first <= 180) return { lat: 55.7,  lon: 37.6,   country: 'Russia' };
  if (first >= 181 && first <= 200) return { lat: -23.5, lon: -46.6,  country: 'Brazil' };
  if (first >= 201 && first <= 210) return { lat: 28.6,  lon: 77.2,   country: 'India' };
  if (first >= 211 && first <= 220) return { lat: 1.3,   lon: 103.8,  country: 'Singapore' };
  return { lat: 39.9, lon: 116.4, country: 'China' };
}

const DEST = { lat: 17.4, lon: 78.5 };

const ATTACK_COLORS: Record<string, string> = {};

interface AttackArc {
  id: string; fromLat: number; fromLon: number;
  country: string; ip: string; type: string; severity: string;
  progress: number; speed: number; color: string;
}

interface CountryFeature {
  id: string;
  name: string;
  paths: [number,number][][];
  rawPaths: [number,number][][];
}

export function ThreatMap() {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const arcsRef        = useRef<AttackArc[]>([]);
  const animIdRef      = useRef<number>(0);
  const tRef           = useRef(0);
  const processedRef   = useRef(0);
  const geoDataRef     = useRef<any>(null);
  const countriesRef   = useRef<CountryFeature[]>([]);
  const hoveredRef     = useRef<string | null>(null);
  const attackedRef    = useRef<Set<string>>(new Set());
  const mouseRef       = useRef({ x: 0, y: 0 });

  const liveAlerts = useAlertsStore((s) => s.alerts);
  const [recentAttacks, setRecentAttacks]   = useState<AttackArc[]>([]);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, critical: 0, countries: new Set<string>() });
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(topo => { geoDataRef.current = topo; setMapLoaded(true); })
      .catch(() => setMapLoaded(true));
  }, []);

  useEffect(() => {
    if (liveAlerts.length <= processedRef.current) return;
    const newOnes = liveAlerts.slice(0, liveAlerts.length - processedRef.current);
    processedRef.current = liveAlerts.length;

    newOnes.forEach(alert => {
      // ✅ Use geoip from alert if available, fallback to ipToGeo
      let geo: { lat: number; lon: number; country: string };
      if (alert.geoip && alert.geoip.lat && alert.geoip.lon && alert.geoip.country) {
        geo = {
          lat: alert.geoip.lat,
          lon: alert.geoip.lon,
          country: alert.geoip.country,
        };
      } else {
        geo = ipToGeo(alert.srcIp);
      }

      const color = alert.severity === 'critical' ? RED : alert.severity === 'high' ? ORANGE : '#FFD700';
      ATTACK_COLORS[geo.country] = color;
      attackedRef.current.add(geo.country);

      arcsRef.current = [{
        id:       alert.id,
        fromLat:  geo.lat,
        fromLon:  geo.lon,
        country:  geo.country,
        ip:       alert.srcIp,
        type:     alert.signature || 'Unknown',  // ✅ use signature not type
        severity: alert.severity,
        progress: 0,
        speed:    0.004 + Math.random() * 0.006,
        color,
      }, ...arcsRef.current].slice(0, 30);

      setRecentAttacks(prev => [{
        id:       alert.id,
        fromLat:  geo.lat,
        fromLon:  geo.lon,
        country:  geo.country,
        ip:       alert.srcIp,
        type:     alert.signature || 'Unknown',  // ✅ use signature not type
        severity: alert.severity,
        progress: 0,
        speed:    0.004,
        color,
      }, ...prev].slice(0, 8));

      setStats(prev => ({
        total:     prev.total + 1,
        critical:  prev.critical + (alert.severity === 'critical' ? 1 : 0),
        countries: new Set([...prev.countries, geo.country]),
      }));
    });
  }, [liveAlerts.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      buildCountries(canvas.width, canvas.height);
    }

    function project(lon: number, lat: number, W: number, H: number) {
      const x  = ((lon + 180) / 360) * W;
      const cl = Math.max(-85, Math.min(85, lat));
      const lr = (cl * Math.PI) / 180;
      const mn = Math.log(Math.tan(Math.PI / 4 + lr / 2));
      const y  = (H / 2) - (W * mn) / (2 * Math.PI);
      return { x, y };
    }

    const ID_TO_NAME: Record<string, string> = {
      '004':'Afghanistan','008':'Albania','012':'Algeria','024':'Angola','032':'Argentina',
      '036':'Australia','040':'Austria','050':'Bangladesh','056':'Belgium','068':'Bolivia',
      '076':'Brazil','100':'Bulgaria','116':'Cambodia','120':'Cameroon','124':'Canada',
      '152':'Chile','156':'China','170':'Colombia','180':'DR Congo','188':'Costa Rica',
      '191':'Croatia','192':'Cuba','196':'Cyprus','203':'Czech Republic','208':'Denmark',
      '218':'Ecuador','818':'Egypt','231':'Ethiopia','246':'Finland','250':'France',
      '276':'Germany','288':'Ghana','300':'Greece','320':'Guatemala','332':'Haiti',
      '340':'Honduras','356':'India','360':'Indonesia','364':'Iran','368':'Iraq',
      '372':'Ireland','376':'Israel','380':'Italy','388':'Jamaica','392':'Japan',
      '400':'Jordan','398':'Kazakhstan','404':'Kenya','408':'North Korea','410':'South Korea',
      '414':'Kuwait','418':'Laos','422':'Lebanon','434':'Libya','484':'Mexico',
      '504':'Morocco','508':'Mozambique','516':'Namibia','524':'Nepal','528':'Netherlands',
      '554':'New Zealand','558':'Nicaragua','566':'Nigeria','578':'Norway','586':'Pakistan',
      '591':'Panama','604':'Peru','608':'Philippines','616':'Poland','620':'Portugal',
      '630':'Puerto Rico','634':'Qatar','642':'Romania','643':'Russia','682':'Saudi Arabia',
      '686':'Senegal','694':'Sierra Leone','703':'Slovakia','706':'Somalia','710':'South Africa',
      '724':'Spain','144':'Sri Lanka','729':'Sudan','752':'Sweden','756':'Switzerland',
      '760':'Syria','764':'Thailand','788':'Tunisia','792':'Turkey','804':'Ukraine',
      '784':'United Arab Emirates','826':'United Kingdom','840':'United States',
      '858':'Uruguay','860':'Uzbekistan','862':'Venezuela','704':'Vietnam','887':'Yemen',
      '894':'Zambia','716':'Zimbabwe',
    };

    function buildCountries(W: number, H: number) {
      if (!geoDataRef.current) return;
      const topo      = geoDataRef.current;
      const transform = topo.transform;
      const scale     = transform?.scale     || [1, 1];
      const translate = transform?.translate || [0, 0];

      const decodedArcs = topo.arcs.map((arc: number[][]) => {
        let x = 0, y = 0;
        return arc.map((d: number[]) => {
          x += d[0]; y += d[1];
          return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number,number];
        });
      });

      const features: CountryFeature[] = [];
      const geoms = topo.objects?.countries?.geometries || [];

      geoms.forEach((geom: any) => {
        const id   = String(geom.id || '');
        const name = ID_TO_NAME[id] || `Country ${id}`;
        const rawPaths: [number,number][][] = [];

        const collectRing = (arcIndices: number[]) => {
          const pts: [number,number][] = [];
          arcIndices.forEach(idx => {
            const rev     = idx < 0;
            const arc     = decodedArcs[rev ? ~idx : idx];
            const ordered = rev ? [...arc].reverse() : arc;
            ordered.forEach(([lon, lat]: [number, number]) => pts.push([lon, lat]));
          });
          if (pts.length > 2) rawPaths.push(pts);
        };

        if (geom.type === 'Polygon')      geom.arcs.forEach(collectRing);
        else if (geom.type === 'MultiPolygon') geom.arcs.forEach((p: number[][]) => p.forEach(collectRing));

        const paths = rawPaths.map(rp =>
          rp.map(([lon, lat]) => {
            const p = project(lon, lat, W, H);
            return [p.x, p.y] as [number,number];
          })
        );
        features.push({ id, name, paths, rawPaths });
      });

      countriesRef.current = features;
    }

    function pointInPolygon(px: number, py: number, poly: [number,number][]): boolean {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    }

    function getCountryAtMouse(mx: number, my: number): string | null {
      for (const f of countriesRef.current) {
        for (const path of f.paths) {
          if (pointInPolygon(mx, my, path)) return f.name;
        }
      }
      return null;
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx   = (e.clientX - rect.left) * (canvas!.width  / rect.width);
      const my   = (e.clientY - rect.top)  * (canvas!.height / rect.height);
      mouseRef.current = { x: mx, y: my };
      const name = getCountryAtMouse(mx, my);
      if (name !== hoveredRef.current) {
        hoveredRef.current = name;
        setHoveredCountry(name);
        canvas!.style.cursor = name ? 'crosshair' : 'default';
      }
    }

    canvas.addEventListener('mousemove', onMouseMove);
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      tRef.current += 0.016;
      const t = tRef.current;

      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = '#050d1a';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(0,180,140,0.07)';
      ctx.lineWidth   = 0.5;
      for (let lon = -180; lon <= 180; lon += 20) {
        ctx.beginPath();
        const p1 = project(lon, -85, W, H);
        const p2 = project(lon,  85, W, H);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      for (let lat = -80; lat <= 80; lat += 20) {
        ctx.beginPath();
        const p1 = project(-180, lat, W, H);
        const p2 = project( 180, lat, W, H);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      countriesRef.current.forEach(feature => {
        const isHovered  = hoveredRef.current === feature.name;
        const isAttacked = attackedRef.current.has(feature.name);
        const atkColor   = ATTACK_COLORS[feature.name];

        feature.paths.forEach(path => {
          if (path.length < 3) return;
          ctx.beginPath();
          ctx.moveTo(path[0][0], path[0][1]);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
          ctx.closePath();

          if (isHovered) {
            ctx.fillStyle   = 'rgba(0,200,160,0.55)';
            ctx.shadowBlur  = 20;
            ctx.shadowColor = '#00FFD4';
            ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.strokeStyle = 'rgba(0,255,212,0.9)';
            ctx.lineWidth   = 1.2;
            ctx.stroke();
          } else if (isAttacked) {
            const r = atkColor === RED    ? '200,50,50'
                    : atkColor === ORANGE ? '180,80,0'
                    : '140,100,0';
            ctx.fillStyle   = `rgba(${r},0.45)`;
            ctx.shadowBlur  = 12;
            ctx.shadowColor = atkColor || RED;
            ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.strokeStyle = `${atkColor || RED}99`;
            ctx.lineWidth   = 0.8;
            ctx.stroke();
          } else {
            ctx.fillStyle   = 'rgba(0,55,45,0.6)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,200,160,0.4)';
            ctx.lineWidth   = 0.5;
            ctx.stroke();
          }
        });
      });

      if (hoveredRef.current) {
        const mx    = mouseRef.current.x;
        const my    = mouseRef.current.y;
        const label = hoveredRef.current;
        const isAtk = attackedRef.current.has(label);
        const col   = isAtk ? (ATTACK_COLORS[label] || CYAN) : CYAN;
        ctx.save();
        ctx.font        = `bold 11px ${monoFont}`;
        const tw        = ctx.measureText(label).width;
        const tx        = Math.min(mx + 12, W - tw - 20);
        const ty        = Math.max(my - 12, 20);
        ctx.fillStyle   = 'rgba(0,8,18,0.85)';
        ctx.strokeStyle = col;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(tx - 6, ty - 14, tw + 12, 22, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle   = col;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = col;
        ctx.fillText(label, tx, ty);
        ctx.shadowBlur  = 0;
        ctx.restore();
      }

      arcsRef.current.forEach(arc => {
        arc.progress = Math.min(1, arc.progress + arc.speed);
        const steps  = 100;
        const drawn  = Math.floor(arc.progress * steps);
        if (drawn < 2) return;

        const fromP = project(arc.fromLon, arc.fromLat, W, H);
        const toP   = project(DEST.lon,    DEST.lat,    W, H);
        const midX  = (fromP.x + toP.x) / 2;
        const midY  = (fromP.y + toP.y) / 2;
        const dx    = toP.x - fromP.x;
        const dy    = toP.y - fromP.y;
        const dist  = Math.sqrt(dx * dx + dy * dy);
        const cpX   = midX - dy * 0.25;
        const cpY   = midY - dist * 0.22;

        ctx.beginPath();
        for (let i = 0; i <= drawn; i++) {
          const f  = i / steps;
          const bx = (1-f)*(1-f)*fromP.x + 2*(1-f)*f*cpX + f*f*toP.x;
          const by = (1-f)*(1-f)*fromP.y + 2*(1-f)*f*cpY + f*f*toP.y;
          if (i === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        const a = 0.4 + arc.progress * 0.5;
        if      (arc.color === RED)    ctx.strokeStyle = `rgba(255,58,58,${a})`;
        else if (arc.color === ORANGE) ctx.strokeStyle = `rgba(255,107,0,${a})`;
        else                           ctx.strokeStyle = `rgba(255,215,0,${a})`;
        ctx.lineWidth   = arc.severity === 'critical' ? 1.8 : 1.2;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = arc.color;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Tip dot
        const tf = arc.progress;
        const tx = (1-tf)*(1-tf)*fromP.x + 2*(1-tf)*tf*cpX + tf*tf*toP.x;
        const ty = (1-tf)*(1-tf)*fromP.y + 2*(1-tf)*tf*cpY + tf*tf*toP.y;
        ctx.beginPath();
        ctx.arc(tx, ty, arc.severity === 'critical' ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle   = arc.color;
        ctx.shadowBlur  = 12;
        ctx.shadowColor = arc.color;
        ctx.fill();
        ctx.shadowBlur  = 0;

        // Source dot
        ctx.beginPath();
        ctx.arc(fromP.x, fromP.y, 3, 0, Math.PI * 2);
        ctx.fillStyle   = arc.color;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = arc.color;
        ctx.fill();
        ctx.shadowBlur  = 0;
      });

      arcsRef.current = arcsRef.current.filter(a => a.progress < 1.2);

      // YOU marker
      const dp    = project(DEST.lon, DEST.lat, W, H);
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, ring * 9 + pulse * 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,255,212,${0.18 - ring * 0.05 + pulse * 0.05})`;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle   = CYAN;
      ctx.shadowBlur  = 18;
      ctx.shadowColor = CYAN;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = CYAN;
      ctx.font        = `bold 9px ${monoFont}`;
      ctx.fillText('◀ YOU', dp.x + 8, dp.y + 3);

      animIdRef.current = requestAnimationFrame(draw);
    }

    buildCountries(canvas.width, canvas.height);
    draw();

    return () => {
      cancelAnimationFrame(animIdRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [mapLoaded]);

  const sevColor = (s: string) => s === 'critical' ? RED : s === 'high' ? ORANGE : '#FFD700';

  return (
    <div style={{ width: '100%', height: '100%', background: '#050d1a', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', fontFamily: monoFont }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,180,0.004) 3px, rgba(0,255,180,0.004) 4px)' }} />

      <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(0,200,180,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 20 }}>
        <div>
          <div style={{ fontFamily: font, fontSize: 13, color: CYAN, letterSpacing: '0.35em', textShadow: `0 0 12px ${CYAN}` }}>GLOBAL THREAT MAP</div>
          <div style={{ fontFamily: monoFont, fontSize: 9, color: DIM, letterSpacing: '0.2em', marginTop: 2 }}>REAL-TIME ATTACK VISUALIZATION</div>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          {[
            { label: 'TOTAL ATTACKS', value: stats.total,         color: CYAN   },
            { label: 'CRITICAL',      value: stats.critical,       color: RED    },
            { label: 'COUNTRIES',     value: stats.countries.size, color: ORANGE },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: font, fontSize: 22, fontWeight: 900, color: s.color, textShadow: `0 0 12px ${s.color}` }}>{s.value}</div>
              <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.5)', letterSpacing: '0.15em' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {hoveredCountry && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontFamily: monoFont, fontSize: 11, color: CYAN, background: 'rgba(0,255,212,0.08)', border: '1px solid rgba(0,255,212,0.3)', padding: '4px 12px', letterSpacing: '0.15em' }}>
            📍 {hoveredCountry}
            {attackedRef.current.has(hoveredCountry) && <span style={{ color: RED, marginLeft: 8 }}>⚠ ATTACK SOURCE</span>}
          </motion.div>
        )}
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 260px', minHeight: 0 }}>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {!mapLoaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: monoFont, fontSize: 10, color: DIM, letterSpacing: '0.2em' }}>
              LOADING MAP DATA...
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', gap: 16, background: 'rgba(0,8,16,0.75)', padding: '6px 12px', border: '1px solid rgba(0,200,180,0.12)' }}>
            {[
              { color: 'rgba(0,200,160,0.55)', label: 'HOVER',    border: CYAN },
              { color: 'rgba(200,50,50,0.45)',  label: 'ATTACKER', border: RED  },
              { color: CYAN,                    label: 'TARGET',   border: CYAN },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 8, background: l.color, border: `1px solid ${l.border}`, borderRadius: 1 }} />
                <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.6)', letterSpacing: '0.1em' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid rgba(0,200,180,0.1)', padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: font, fontSize: 9, color: DIM, letterSpacing: '0.25em', marginBottom: 6, borderBottom: '1px solid rgba(0,200,180,0.12)', paddingBottom: 6 }}>INCOMING ATTACKS</div>
          {recentAttacks.length === 0 ? (
            <div style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(150,200,200,0.3)', textAlign: 'center', marginTop: 40, lineHeight: 2 }}>🛡️<br />Monitoring...<br />No attacks</div>
          ) : (
            <AnimatePresence mode="popLayout">
              {recentAttacks.map(arc => (
                <motion.div key={arc.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.3 }}
                  style={{ padding: '8px 10px', background: `rgba(${arc.color === RED ? '255,58,58' : arc.color === ORANGE ? '255,107,0' : '255,215,0'},0.07)`, border: `1px solid ${arc.color}25`, borderRadius: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontFamily: monoFont, fontSize: 8, color: sevColor(arc.severity), textTransform: 'uppercase', fontWeight: 700 }}>{arc.severity}</span>
                    <span style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.4)' }}>🌍 {arc.country}</span>
                  </div>
                  <div style={{ fontFamily: monoFont, fontSize: 9, color: 'rgba(200,230,230,0.85)', marginBottom: 2 }}>{arc.ip}</div>
                  <div style={{ fontFamily: monoFont, fontSize: 8, color: 'rgba(150,200,200,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{arc.type}</div>
                  <div style={{ marginTop: 5, height: 1.5, background: 'rgba(0,200,180,0.1)', overflow: 'hidden' }}>
                    <motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 4, ease: 'linear' }}
                      style={{ height: '100%', background: arc.color, boxShadow: `0 0 4px ${arc.color}` }} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
