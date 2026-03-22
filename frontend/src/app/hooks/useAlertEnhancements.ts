/**
 * useAlertEnhancements — Sound + Browser Notifications + Theme shifting
 * Import this once in Dashboard.tsx
 */

import { useEffect, useRef } from 'react';

// ── Sound synthesis using Web Audio API (no external files needed) ──────────
function createAlertSound(ctx: AudioContext, severity: string) {
  const freq = severity === 'critical' ? 880
             : severity === 'high'     ? 660
             : 440;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type      = severity === 'critical' ? 'sawtooth' : 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  if (severity === 'critical') {
    // Urgent double-beep
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.setValueAtTime(freq * 1.2, ctx.currentTime + 0.2);
  } else if (severity === 'high') {
    // Single beep
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
  } else {
    // Soft ping
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  }

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

// ── Browser notification ────────────────────────────────────────────────────
function sendNotification(alert: any) {
  if (Notification.permission !== 'granted') return;
  const icon = alert.severity === 'critical' ? '🔴'
             : alert.severity === 'high'     ? '🟠' : '🟡';
  new Notification(`${icon} NETRAITH ALERT — ${alert.severity?.toUpperCase()}`, {
    body: `${alert.signature}\nSource: ${alert.src_ip || alert.srcIp}`,
    tag:  alert.id,
    requireInteraction: alert.severity === 'critical',
  });
}

// ── Theme CSS variable injection ────────────────────────────────────────────
export function applyThreatTheme(threatLevel: number) {
  const root = document.documentElement;
  if (threatLevel > 85) {
    // CRITICAL — red tint
    root.style.setProperty('--threat-overlay', 'rgba(255,20,20,0.04)');
    root.style.setProperty('--threat-border',  'rgba(255,50,50,0.35)');
    root.style.setProperty('--threat-glow',    '0 0 30px rgba(255,30,30,0.2)');
  } else if (threatLevel > 70) {
    // HIGH — orange tint
    root.style.setProperty('--threat-overlay', 'rgba(255,100,0,0.03)');
    root.style.setProperty('--threat-border',  'rgba(255,107,0,0.25)');
    root.style.setProperty('--threat-glow',    '0 0 20px rgba(255,100,0,0.1)');
  } else {
    // NORMAL — cyan
    root.style.setProperty('--threat-overlay', 'rgba(0,255,212,0.0)');
    root.style.setProperty('--threat-border',  'rgba(0,200,180,0.18)');
    root.style.setProperty('--threat-glow',    'none');
  }
}

// ── Main hook ───────────────────────────────────────────────────────────────
export function useAlertEnhancements(
  liveAlerts: any[],
  threatLevel: number,
  soundEnabled: boolean = true
) {
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const processedRef  = useRef(0);
  const permAskedRef  = useRef(false);

  // Request notification permission once
  useEffect(() => {
    if (!permAskedRef.current && Notification.permission === 'default') {
      Notification.requestPermission();
      permAskedRef.current = true;
    }
  }, []);

  // React to new alerts
  useEffect(() => {
    if (liveAlerts.length <= processedRef.current) return;
    const newOnes = liveAlerts.slice(0, liveAlerts.length - processedRef.current);
    processedRef.current = liveAlerts.length;

    newOnes.forEach(alert => {
      // Sound
      if (soundEnabled) {
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') ctx.resume();
          createAlertSound(ctx, alert.severity);
        } catch (_) {}
      }

      // Notification
      sendNotification(alert);
    });
  }, [liveAlerts.length, soundEnabled]);

  // Theme shifting
  useEffect(() => {
    applyThreatTheme(threatLevel);
  }, [threatLevel]);
}