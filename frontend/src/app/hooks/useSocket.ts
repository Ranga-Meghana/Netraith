/**
 * useSocket.ts
 * Central Socket.IO connection hook for Netraith.
 * Connects once, emits events to the alerts store.
 */

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAlertsStore } from "../store/alertsStore";

const BACKEND_URL = (import.meta as any).env?.VITE_API_URL ?? "https://netraith-backend.onrender.com";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addAlert, setConnected, setConnectionError } = useAlertsStore();

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setConnected(true);
      setConnectionError(null);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
      setConnected(false);
      setConnectionError(err.message);
    });

    socket.on("new_alert", (raw: any) => {
      console.log("[Socket] new_alert received:", raw);
      addAlert(normalizeAlert(raw));
    });

    socket.on("alerts_batch", (alerts: any[]) => {
      alerts.forEach((a) => addAlert(normalizeAlert(a)));
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("new_alert");
      socket.off("alerts_batch");
      socket.disconnect();
    };
  }, [addAlert, setConnected, setConnectionError]);

  return socketRef.current;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  timestamp: string;
  signature: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  srcIp: string;
  destIp: string;
  srcPort: number | null;
  destPort: number | null;
  proto: string;
  geoip?: { lat: number; lon: number; country: string }; // ✅ added
}

/**
 * Normalizes raw alert from simulator.py / suricata_watcher.py
 */
function normalizeAlert(raw: any): Alert {
  const severity = raw.severity ?? "medium";
  const validSeverities = ["critical", "high", "medium", "low"];
  const normalizedSeverity = validSeverities.includes(severity) ? severity : "medium";

  return {
    id:        raw.id ?? crypto.randomUUID(),
    timestamp: raw.timestamp ?? new Date().toISOString(),
    signature: raw.signature ?? raw.alert?.signature ?? "Unknown Alert",
    severity:  normalizedSeverity as Alert["severity"],
    category:  raw.category ?? raw.alert?.category ?? "Generic",
    srcIp:     raw.src_ip ?? raw.source_ip ?? "0.0.0.0",
    destIp:    raw.dest_ip ?? raw.destination_ip ?? "0.0.0.0",
    srcPort:   raw.src_port ?? null,
    destPort:  raw.dest_port ?? null,
    proto:     raw.proto ?? "TCP",
    geoip:     raw.geoip ?? null, // ✅ added
  };
}
