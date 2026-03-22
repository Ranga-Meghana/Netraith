/**
 * SocketProvider.tsx
 * Mount this ONCE near the top of your component tree (e.g. in App.tsx).
 * It calls useSocket() which sets up the single shared connection.
 * All child components read from alertsStore — no prop drilling.
 */

import { useSocket } from "../hooks/useSocket";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket(); // establishes & manages the socket lifecycle
  return <>{children}</>;
}