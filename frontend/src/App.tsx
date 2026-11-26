import { useCallback, useEffect, useRef } from "react";
import { ControlDrawer } from "./components/ControlDrawer";
import { TopTelemetryBar } from "./components/TopTelemetryBar";
import { TerminalSyncController } from "./services/apiClient";
import { TerminalWsClient } from "./services/wsClient";
import { useTerminalStore } from "./store/useTerminalStore";
import type { TimeframeLiteral } from "./types/terminal";

export function App() {
  const syncRef = useRef<TerminalSyncController | null>(null);
  const wsRef = useRef<TerminalWsClient | null>(null);

  const candleCount = useTerminalStore((s) => s.candles.length);
  const whaleCount = useTerminalStore((s) => s.whales.length);
  const bandCount = useTerminalStore((s) => s.predictedLiqBands.length);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const wsStatus = useTerminalStore((s) => s.wsStatus);

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
        <main className="terminal-chart-host flex items-center justify-center">
          <div
            className="hairline-border px-4 py-3 rounded-[2px] flex flex-col gap-1"
            style={{ backgroundColor: "var(--bg-surface)" }}
          >
            <span
              className="text-[11px] uppercase tracking-[0.04em]"
              style={{ color: "var(--text-muted)" }}
            >
              BTCUSDT PERPETUAL · CHART HOST READY
            </span>
            <div className="font-mono-tabular text-[12px] flex items-center gap-3">
              <span>TF {timeframe}</span>
              <span>WS {wsStatus.toUpperCase()}</span>
              <span>BARS {candleCount}</span>
              <span>WHALES {whaleCount}</span>
              <span>LIQ BANDS {bandCount}</span>
            </div>
          </div>
        </main>
        <ControlDrawer onSelectExpiry={handleSelectExpiry} />
      </div>
    </div>
  );
}

export default App;
