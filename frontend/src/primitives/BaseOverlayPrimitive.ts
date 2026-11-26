import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

export type RenderTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

class OverlayRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly renderFn: (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
    ) => void,
  ) {}

  draw(target: RenderTarget): void {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      this.renderFn(context, mediaSize.width, mediaSize.height);
    });
  }
}

export abstract class BaseOverlayPrimitive implements ISeriesPrimitive<Time> {
  protected chart: IChartApi | null = null;
  protected series: ISeriesApi<"Candlestick"> | null = null;
  protected requestUpdateCallback: (() => void) | null = null;
  private readonly paneView: IPrimitivePaneView;

  constructor(zOrder: PrimitivePaneViewZOrder = "normal") {
    const renderer = new OverlayRenderer((ctx, w, h) =>
      this.drawOverlay(ctx, w, h),
    );
    this.paneView = {
      zOrder: () => zOrder,
      renderer: () => renderer,
    };
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart as IChartApi;
    this.series = param.series as ISeriesApi<"Candlestick">;
    this.requestUpdateCallback = param.requestUpdate;
    this.onAttached();
  }

  detached(): void {
    this.onDetached();
    this.chart = null;
    this.series = null;
    this.requestUpdateCallback = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  public triggerUpdate(): void {
    this.requestUpdateCallback?.();
  }

  protected onAttached(): void {}

  protected onDetached(): void {}

  protected crispY(rawY: number): number {
    return Math.floor(rawY) + 0.5;
  }

  protected abstract drawOverlay(
    ctx: CanvasRenderingContext2D,
    mediaWidth: number,
    mediaHeight: number,
  ): void;
}
