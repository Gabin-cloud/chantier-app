"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type PlanViewerMarker = {
  id: string;
  x_percent: number;
  y_percent: number;
  marker_number: number;
};

type Transform = {
  scale: number;
  x: number;
  y: number;
};

type PlanViewerProps = {
  url: string;
  addMode?: boolean;
  markers: PlanViewerMarker[];
  selectedMarkerId?: string | null;
  onPlanClick?: (xPercent: number, yPercent: number) => void;
  onMarkerClick?: (markerId: string) => void;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PlanViewer({
  url,
  addMode = false,
  markers,
  selectedMarkerId,
  onPlanClick,
  onMarkerClick,
}: PlanViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pointersRef = useRef(
    new Map<number, { x: number; y: number; startX: number; startY: number }>()
  );
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  );
  const tapMovedRef = useRef(false);

  const applyTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  const fitToViewport = useCallback(
    (size: { width: number; height: number }) => {
      const viewport = viewportRef.current;
      if (!viewport || size.width === 0) return;

      const padding = 12;
      const vw = viewport.clientWidth - padding * 2;
      const vh = viewport.clientHeight - padding * 2;
      const scale = clamp(Math.min(vw / size.width, vh / size.height), MIN_SCALE, MAX_SCALE);
      const x = (viewport.clientWidth - size.width * scale) / 2;
      const y = (viewport.clientHeight - size.height * scale) / 2;
      applyTransform({ scale, x, y });
    },
    [applyTransform]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const pdf = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        const size = { width: viewport.width, height: viewport.height };
        setPageSize(size);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const renderViewport = page.getViewport({ scale: dpr });
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D indisponible.");

        await page.render({ canvasContext: context, viewport: renderViewport, canvas })
          .promise;

        if (!cancelled) {
          fitToViewport(size);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Impossible de charger le plan PDF."
          );
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [url, fitToViewport]);

  useEffect(() => {
    if (pageSize.width === 0) return;

    fitToViewport(pageSize);

    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      fitToViewport(pageSize);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [pageSize, fitToViewport]);

  function zoomBy(factor: number) {
    const viewport = viewportRef.current;
    if (!viewport || pageSize.width === 0) return;

    const current = transformRef.current;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
    const ratio = nextScale / current.scale;
    const nextX = centerX - (centerX - current.x) * ratio;
    const nextY = centerY - (centerY - current.y) * ratio;
    applyTransform({ scale: nextScale, x: nextX, y: nextY });
  }

  function resetView() {
    fitToViewport(pageSize);
  }

  function clientToPercent(clientX: number, clientY: number) {
    const layer = layerRef.current;
    if (!layer) return null;

    const rect = layer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const xPercent = ((clientX - rect.left) / rect.width) * 100;
    const yPercent = ((clientY - rect.top) / rect.height) * 100;
    return {
      xPercent: clamp(xPercent, 0, 100),
      yPercent: clamp(yPercent, 0, 100),
    };
  }

  function isMarkerTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("[data-plan-marker]"));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (isMarkerTarget(e.target)) return;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    });
    tapMovedRef.current = false;

    if (pointersRef.current.size === 1 && !addMode) {
      const current = transformRef.current;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: current.x,
        ty: current.y,
      };
    }

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const distance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchRef.current = { distance, scale: transformRef.current.scale };
      panStartRef.current = null;
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (isMarkerTarget(e.target)) return;

    const pointer = pointersRef.current.get(e.pointerId);
    if (!pointer) return;

    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 8) {
      tapMovedRef.current = true;
    }

    pointersRef.current.set(e.pointerId, {
      ...pointer,
      x: e.clientX,
      y: e.clientY,
    });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const distance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (pinchRef.current.distance > 0) {
        const nextScale = clamp(
          pinchRef.current.scale * (distance / pinchRef.current.distance),
          MIN_SCALE,
          MAX_SCALE
        );
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const current = transformRef.current;
        const ratio = nextScale / current.scale;
        applyTransform({
          scale: nextScale,
          x: midX - (midX - current.x) * ratio,
          y: midY - (midY - current.y) * ratio,
        });
      }
      return;
    }

    if (pointersRef.current.size === 1 && panStartRef.current && !addMode) {
      applyTransform({
        ...transformRef.current,
        x: panStartRef.current.tx + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.ty + (e.clientY - panStartRef.current.y),
      });
    }
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const wasTap =
      pointersRef.current.size === 1 &&
      !tapMovedRef.current &&
      addMode &&
      onPlanClick;

    if (wasTap) {
      const coords = clientToPercent(e.clientX, e.clientY);
      if (coords) {
        onPlanClick(coords.xPercent, coords.yPercent);
      }
    }

    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function handleMarkerClick(
    e: React.MouseEvent<HTMLButtonElement>,
    markerId: string
  ) {
    e.stopPropagation();
    onMarkerClick?.(markerId);
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="absolute right-3 top-3 z-20 flex gap-2">
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-lg font-bold text-zinc-800 shadow-md backdrop-blur active:scale-95"
          aria-label="Zoomer"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.8)}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-lg font-bold text-zinc-800 shadow-md backdrop-blur active:scale-95"
          aria-label="Dézoomer"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          className="flex h-11 items-center justify-center rounded-xl bg-white/95 px-3 text-xs font-semibold text-zinc-700 shadow-md backdrop-blur active:scale-95"
        >
          Ajuster
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`relative h-full min-h-0 flex-1 touch-none overflow-hidden bg-zinc-200/80 ${
          addMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-100/90">
            <p className="text-sm font-medium text-zinc-600">Chargement du plan…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {pageSize.width > 0 && (
          <div
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{
              width: pageSize.width,
              height: pageSize.height,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          >
            <div ref={layerRef} className="relative h-full w-full">
              <canvas ref={canvasRef} className="block h-full w-full" />
              <div className="pointer-events-none absolute inset-0">
                {markers.map((marker) => (
                  <button
                    key={marker.id}
                    type="button"
                    data-plan-marker
                    style={{
                      left: `${marker.x_percent}%`,
                      top: `${marker.y_percent}%`,
                    }}
                    onClick={(e) => handleMarkerClick(e, marker.id)}
                    className={`pointer-events-auto absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold shadow-lg transition-transform active:scale-110 ${
                      selectedMarkerId === marker.id
                        ? "border-white bg-amber-500 text-white ring-4 ring-amber-300"
                        : "border-white bg-red-600 text-white"
                    }`}
                  >
                    {marker.marker_number}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
