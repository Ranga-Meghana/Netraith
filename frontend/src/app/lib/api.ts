/**
 * Netraith — Backend API Client
 * Drop this file into: src/lib/api.ts
 *
 * Usage:
 *   import { api, connectSocket } from "@/lib/api"
 *
 *   const { alerts } = await api.getAlerts({ limit: 20, severity: "critical" })
 *   api.simulate("ddos")
 *
 *   const socket = connectSocket()
 *   socket.on("new_alert", (alert) => { ... })
 */

import { io, Socket } from "socket.io-client"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000"

// ── Types ────────────────────────────────────────────────────────────────────

export type Severity = "low" | "medium" | "high" | "critical"

export interface GeoIP {
  country: string
  lat: number
  lon: number
}

export interface Alert {
  id: string
  timestamp: string
  severity: Severity
  src_ip: string
  src_port: number
  dest_ip: string
  dest_port: number
  proto: string
  signature: string
  category: string
  action: string
  simulated?: boolean
  geoip: GeoIP
}

export interface Stats {
  total: number
  severity_counts: Record<Severity, number>
  category_counts: Record<string, number>
  top_src_ips: { ip: string; count: number }[]
}

export interface AISummary {
  summary: string
  risk_level: Severity
  confidence: string
  recommended: string
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  /** Fetch latest alerts (REST fallback if WebSocket is not used) */
  getAlerts(params?: { limit?: number; severity?: Severity }) {
    const qs = new URLSearchParams()
    if (params?.limit)    qs.set("limit",    String(params.limit))
    if (params?.severity) qs.set("severity", params.severity)
    const q = qs.toString()
    return request<{ alerts: Alert[]; count: number }>(
      `/api/alerts/${q ? "?" + q : ""}`
    )
  },

  /** Clear all alerts */
  clearAlerts() {
    return request<{ message: string }>("/api/alerts/", { method: "DELETE" })
  },

  /** Trigger a simulated attack */
  simulate(attackType: string, count = 1) {
    return request<{ message: string; alerts: Alert[] }>(
      `/api/simulate/${attackType}`,
      { method: "POST", body: JSON.stringify({ count }) }
    )
  },

  /** List supported attack types */
  getAttackTypes() {
    return request<{ attack_types: string[] }>("/api/simulate/types")
  },

  /** Dashboard stats */
  getStats() {
    return request<Stats>("/api/stats/")
  },

  /** AI analysis of a single alert */
  analyseAlert(alert: Alert) {
    return request<AISummary>("/api/ai/analyse", {
      method: "POST",
      body: JSON.stringify(alert),
    })
  },

  /** Batch AI summary of latest N alerts */
  batchSummary(limit = 50) {
    return request<AISummary & { breakdown: Record<string, number> }>(
      `/api/ai/summary?limit=${limit}`
    )
  },

  /** Health check */
  health() {
    return request<{ status: string }>("/api/health")
  },
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

let _socket: Socket | null = null

/**
 * Returns a singleton Socket.IO connection to the backend.
 * Listen for "new_alert" events to get live Suricata/simulated alerts.
 *
 * Example:
 *   const socket = connectSocket()
 *   socket.on("new_alert", (alert: Alert) => setAlerts(prev => [alert, ...prev]))
 */
export function connectSocket(): Socket {
  if (!_socket) {
    _socket = io(BASE_URL, { transports: ["websocket"] })
    _socket.on("connect",    () => console.log("[WS] Connected to Netraith backend"))
    _socket.on("disconnect", () => console.log("[WS] Disconnected"))
  }
  return _socket
}

export function disconnectSocket(): void {
  _socket?.disconnect()
  _socket = null
}