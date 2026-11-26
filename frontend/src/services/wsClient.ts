import type {
  TimeframeLiteral,
  WsClientCommand,
  WsServerEvent,
} from "../types/terminal";
import { useTerminalStore } from "../store/useTerminalStore";

const MIN_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 15000;

export function resolveWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }
  if (typeof window !== "undefined" && window.location.host) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.hostname}:8000/ws/btc`;
  }
  return "ws://localhost:8000/ws/btc";
}

export class TerminalWsClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = MIN_RECONNECT_MS;
  private intentionallyClosed = false;
  private hasConnectedOnce = false;
  private readonly onReconnect?: () => void;

  constructor(options?: { onReconnect?: () => void }) {
    this.onReconnect = options?.onReconnect;
  }

  connect(): void {
    this.intentionallyClosed = false;
    this.clearReconnectTimer();

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const store = useTerminalStore.getState();
    store.setWsStatus(this.hasConnectedOnce ? "reconnecting" : "connecting");

    const ws = new WebSocket(resolveWsUrl());
    this.socket = ws;

    ws.onopen = () => {
      const wasReconnect = this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      this.backoffMs = MIN_RECONNECT_MS;
      const current = useTerminalStore.getState();
      current.setWsStatus("connected");
      this.sendCommand({ type: "set_timeframe", interval: current.timeframe });
      if (wasReconnect) {
        this.onReconnect?.();
      }
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as WsServerEvent;
        this.dispatchEvent(payload);
      } catch {
        // Ignore malformed frames rather than crashing the terminal stream.
      }
    };

    ws.onerror = () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };

    ws.onclose = () => {
      if (this.socket === ws) {
        this.socket = null;
      }
      if (this.intentionallyClosed) {
        useTerminalStore.getState().setWsStatus("disconnected");
        return;
      }
      useTerminalStore.getState().setWsStatus("reconnecting");
      this.scheduleReconnect();
    };
  }

  setTimeframe(interval: TimeframeLiteral): void {
    this.sendCommand({ type: "set_timeframe", interval });
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    useTerminalStore.getState().setWsStatus("disconnected");
  }

  private sendCommand(command: WsClientCommand): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(command));
    }
  }

  private dispatchEvent(msg: WsServerEvent): void {
    const store = useTerminalStore.getState();
    switch (msg.type) {
      case "kline":
        store.applyLiveKline(msg.interval, msg.candle);
        break;
      case "whale":
        store.appendWhale(msg.data);
        break;
      case "liquidation":
        store.appendRealizedLiquidation(msg.data);
        break;
      case "liq_bands":
        store.setPredictedLiqBands(msg.interval, msg.bands);
        break;
      case "telemetry":
        store.setTelemetry(msg.data);
        break;
      case "options_update":
        store.applyOptionsUpdate(msg.available_expiries, msg.surfaces_by_expiry);
        break;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = this.backoffMs;
    this.backoffMs = Math.min(MAX_RECONNECT_MS, this.backoffMs * 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionallyClosed) {
        this.connect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
