/**
 * useAlerts — React hook for live Suricata / simulated alerts
 * Drop into: src/hooks/useAlerts.ts
 *
 * Usage:
 *   const { alerts, stats, aiSummary, isConnected } = useAlerts()
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { api, connectSocket, Alert, Stats, AISummary } from "../lib/api"

const MAX_ALERTS = 200   // keep last 200 in state

export function useAlerts() {
  const [alerts,      setAlerts]      = useState<Alert[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [aiSummary,   setAiSummary]   = useState<AISummary | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(connectSocket())

  // ── Boot: load existing alerts + stats ─────────────────────────────────────
  useEffect(() => {
    api.getAlerts({ limit: 50 }).then(r => setAlerts(r.alerts)).catch(console.error)
    api.getStats().then(setStats).catch(console.error)
    api.batchSummary().then(setAiSummary).catch(console.error)
  }, [])

  // ── WebSocket: stream new alerts ───────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current

    socket.on("connect",    () => setIsConnected(true))
    socket.on("disconnect", () => setIsConnected(false))

    socket.on("new_alert", (alert: Alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, MAX_ALERTS))
      // Refresh stats every 5 new alerts instead of on each one
      setStats(prev => {
        if (!prev) return prev
        const counts = { ...prev.severity_counts }
        counts[alert.severity] = (counts[alert.severity] ?? 0) + 1
        return { ...prev, total: prev.total + 1, severity_counts: counts }
      })
    })

    return () => {
      socket.off("new_alert")
      socket.off("connect")
      socket.off("disconnect")
    }
  }, [])

  // ── Simulate attack ────────────────────────────────────────────────────────
  const simulate = useCallback(async (attackType: string, count = 1) => {
    await api.simulate(attackType, count)
    // Alerts arrive via WebSocket — no need to re-fetch
  }, [])

  // ── Refresh stats manually ─────────────────────────────────────────────────
  const refreshStats = useCallback(async () => {
    const [s, ai] = await Promise.all([api.getStats(), api.batchSummary()])
    setStats(s)
    setAiSummary(ai)
  }, [])

  return { alerts, stats, aiSummary, isConnected, simulate, refreshStats }
}