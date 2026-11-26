import { useCallback, useEffect, useRef } from "react";
import { ControlDrawer } from "./components/ControlDrawer";
import { LegendDrawer } from "./components/LegendDrawer";
import { TopTelemetryBar } from "./components/TopTelemetryBar";
import { UnifiedChart } from "./components/UnifiedChart";
import { TerminalSyncController } from "./services/apiClient";
import { TerminalWsClient } from "./services/wsClient";
import { useTerminalStore } from "./store/useTerminalStore";
import type { TimeframeLiteral } from "./types/terminal";

export function App() {
  const syncRef = useRef<TerminalSyncController | null>(null);
  const wsRef = useRef<TerminalWsClient | null>(null);

  useEffect(() => {
    const sync = new TerminalSyncController();
    syncRef.current = sync;

    const ws = new TerminalWsClient({
      onReconnect: () => {
        const current = useTerminalStore.getState();
        void sync.syncAll(current.timeframe, current.selectedExpiry);
      },
    });
    wsRef.current = ws;

    const initial = useTerminalStore.getState();
    void sync.syncAll(initial.timeframe, initial.selectedExpiry);
    ws.connect();

    return () => {
      ws.disconnect();
      sync.dispose();
      wsRef.current = null;
      syncRef.current = null;
    };
  }, []);

  const handleSelectTimeframe = useCallback((interval: TimeframeLiteral) => {
    useTerminalStore.getState().setTimeframe(interval);
    wsRef.current?.setTimeframe(interval);
    void syncRef.current?.syncTimeframe(interval);
  }, []);

  const handleSelectExpiry = useCallback((expiry: string) => {
    useTerminalStore.getState().setSelectedExpiry(expiry);
    void syncRef.current?.syncOptionsExpiry(expiry);
  }, []);

  return (
    <div className="terminal-shell">
      <TopTelemetryBar onSelectTimeframe={handleSelectTimeframe} />
      <div className="terminal-workspace">
        <main className="terminal-chart-host">
          <UnifiedChart />
        </main>
        <ControlDrawer onSelectExpiry={handleSelectExpiry} />
        <LegendDrawer />
      </div>
    </div>
  );
}

export default App;
