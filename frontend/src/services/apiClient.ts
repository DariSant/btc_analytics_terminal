import type {
  HealthResponse,
  KlinesResponse,
  OptionsResponse,
  OverlaysHistoryResponse,
  TimeframeLiteral,
} from "../types/terminal";
import { useTerminalStore } from "../store/useTerminalStore";
import {
  getFixedWhaleMinUsd,
  getOverlayHistoryWindowMs,
} from "../utils/whaleEscalation";

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  const raw = configured !== undefined ? configured : "http://localhost:8000";
  return raw.replace(/\/+$/, "");
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const url = `${resolveApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return fetchJson<HealthResponse>("/api/v1/health", signal);
}

export function fetchKlines(
  interval: TimeframeLiteral,
  limit: number = 1500,
  signal?: AbortSignal,
): Promise<KlinesResponse> {
  const params = new URLSearchParams({
    interval,
    limit: String(limit),
  });
  return fetchJson<KlinesResponse>(`/api/v1/klines?${params.toString()}`, signal);
}

export function fetchOverlaysHistory(
  sinceMs?: number,
  minWhaleUsd: number = 250000,
  signal?: AbortSignal,
): Promise<OverlaysHistoryResponse> {
  const params = new URLSearchParams({
    min_whale_usd: String(minWhaleUsd),
  });
  if (sinceMs !== undefined) {
    params.set("since_ms", String(sinceMs));
  }
  return fetchJson<OverlaysHistoryResponse>(
    `/api/v1/overlays/history?${params.toString()}`,
    signal,
  );
}

export function fetchOptions(
  expiry: string = "ALL",
  signal?: AbortSignal,
): Promise<OptionsResponse> {
  const params = new URLSearchParams({ expiry });
  return fetchJson<OptionsResponse>(`/api/v1/options?${params.toString()}`, signal);
}

export class TerminalSyncController {
  private klinesAbort: AbortController | null = null;
  private overlaysAbort: AbortController | null = null;
  private bootstrapAbort: AbortController | null = null;
  private klinesSeq = 0;
  private overlaysSeq = 0;

  async syncTimeframe(interval: TimeframeLiteral): Promise<void> {
    this.klinesAbort?.abort();
    const controller = new AbortController();
    this.klinesAbort = controller;
    const seq = ++this.klinesSeq;

    try {
      const data = await fetchKlines(interval, 1500, controller.signal);
      if (seq !== this.klinesSeq || controller.signal.aborted) {
        return;
      }
      useTerminalStore
        .getState()
        .applyKlinesSnapshot(data.interval, data.candles, data.predicted_liquidations);
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      throw err;
    }
  }

  async syncOverlays(interval: TimeframeLiteral): Promise<void> {
    this.overlaysAbort?.abort();
    const controller = new AbortController();
    this.overlaysAbort = controller;
    const seq = ++this.overlaysSeq;

    const fixedMin = getFixedWhaleMinUsd(interval);
    const sinceMs = Date.now() - getOverlayHistoryWindowMs(interval);

    try {
      const res = await fetchOverlaysHistory(
        sinceMs,
        fixedMin,
        controller.signal,
      );
      if (seq !== this.overlaysSeq || controller.signal.aborted) {
        return;
      }
      useTerminalStore
        .getState()
        .applyOverlaysHistory(res.whales, res.liquidations);
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      throw err;
    }
  }

  async syncAll(interval: TimeframeLiteral, expiry: string): Promise<void> {
    this.bootstrapAbort?.abort();
    const controller = new AbortController();
    this.bootstrapAbort = controller;

    const [, , optionsResult] = await Promise.allSettled([
      this.syncTimeframe(interval),
      this.syncOverlays(interval),
      fetchOptions(expiry, controller.signal),
    ]);

    if (controller.signal.aborted) {
      return;
    }

    if (optionsResult.status === "fulfilled") {
      useTerminalStore.getState().applyOptionsResponse(optionsResult.value);
    }
  }

  async syncOptionsExpiry(expiry: string): Promise<void> {
    const res = await fetchOptions(expiry);
    useTerminalStore.getState().applyOptionsResponse(res);
  }

  dispose(): void {
    this.klinesAbort?.abort();
    this.overlaysAbort?.abort();
    this.bootstrapAbort?.abort();
    this.klinesAbort = null;
    this.overlaysAbort = null;
    this.bootstrapAbort = null;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
