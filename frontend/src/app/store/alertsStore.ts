/**
 * alertsStore.ts
 * Global state for live alerts + connection status.
 */

import { create } from "zustand";
import type { Alert } from "../hooks/useSocket";

const MAX_ALERTS = 500; // ring-buffer cap (mirrors backend)

interface AlertsState {
  // ── Data ────────────────────────────────────────────────────────────────
  alerts: Alert[];
  connected: boolean;
  connectionError: string | null;

  // ── Derived helpers ──────────────────────────────────────────────────────
  highCount: () => number;
  mediumCount: () => number;
  lowCount: () => number;

  // ── Actions ──────────────────────────────────────────────────────────────
  addAlert: (alert: Alert) => void;
  clearAlerts: () => void;
  setConnected: (v: boolean) => void;
  setConnectionError: (msg: string | null) => void;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  connected: false,
  connectionError: null,

  // ── Derived ──────────────────────────────────────────────────────────────
  // Backend sends "critical" | "high" | "medium" | "low"
  highCount:   () => get().alerts.filter((a) => a.severity === "critical" || a.severity === "high").length,
  mediumCount: () => get().alerts.filter((a) => a.severity === "medium").length,
  lowCount:    () => get().alerts.filter((a) => a.severity === "low").length,

  // ── Actions ──────────────────────────────────────────────────────────────
  addAlert: (alert) =>
    set((state) => {
      const updated = [alert, ...state.alerts];
      return { alerts: updated.slice(0, MAX_ALERTS) };
    }),

  clearAlerts: () => set({ alerts: [] }),

  setConnected: (v) => set({ connected: v }),

  setConnectionError: (msg) => set({ connectionError: msg }),
}));