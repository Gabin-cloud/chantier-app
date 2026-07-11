"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DrawingStroke } from "@/lib/types/database";

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
  pdfUrl: string;
  addMode?: boolean;
  drawMode?: boolean;
  markers: PlanViewerMarker[];
  strokes?: DrawingStroke[];
  onStrokesChange?: (strokes: DrawingStroke[]) => void;
  selectedMarkerId?: string | null;
  onPlanClick?: (xPercent: number, yPercent: number) => void;
  onMarkerClick?: (markerId: string) => void;
  readOnly?: boolean;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
const DRAW_COLOR = "#f59e0b";
const DRAW_WIDTH = 2.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function strokeToPath(stroke: DrawingStroke) {
  if (stroke.points.length === 0) return "";
  const [first, ...rest] = stroke.points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}

export function PlanViewer({
  pdfUrl,
  addMode = false,
  drawMode = false,
  markers,
  strokes = [],
  onStrokesChange,
  selectedMarkerId,
  onPlanClick,
  onMarkerClick,
  readOnly = false,
}: PlanViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<import("pdfjs-dist").PDFPageProxy | null>(null);
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docReady, setDocReady] = useState(false);
  const [liveStroke, setLiveStroke] = useState<DrawingStroke | null>(null);

  const pointersRef = useRef(
    new Map<number, { x: number; y: number; startX: number; startY: number }>()
  );
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  );
  const tapMovedRef = useRef(false);
  const interactionLocked = addMode || drawMode;

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
      applyTransform({
        scale,
        x: (viewport.clientWidth - size.width * scale) / 2,
        y: (viewport.clientHeight - size.height * scale) / 2,
      });
    },
    [applyTransform]
  );

  useEffect(() => {
    let cancelled = false;
    pageRef.current = null;
    setDocReady(false);
    setPageSize({ width: 0, height: 0 });
    setLoading(true);
    setError(null);

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const pdf = await pdfjs.getDocument({ url: pdfUrl, withCredentials: true }).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        pageRef.current = page;
        setPageSize({ width: viewport.width, height: viewport.height });
        setDocReady(true);
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
  }, [pdfUrl]);

  useEffect(() => {
    if (!docReady || pageSize.width === 0 || !pageRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    async function renderPage() {
      try {
        const page = pageRef.current!;
        const viewport = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const renderViewport = page.getViewport({ scale: dpr });
        const canvasEl = canvas!;

        canvasEl.width = renderViewport.width;
        canvasEl.height = renderViewport.height;
        canvasEl.style.width = `${viewport.width}px`;
        canvasEl.style.height = `${viewport.height}px`;

        const context = canvasEl.getContext("2d");
        if (!context) throw new Error("Canvas 2D indisponible.");

        await page.render({
          canvasContext: context,
          viewport: renderViewport,
          canvas: canvasEl,
        }).promise;

        if (!cancelled) {
          fitToViewport(pageSize);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erreur lors du rendu du plan."
          );
          setLoading(false);
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [docReady, pageSize, fitToViewport]);

  useEffect(() => {
    if (pageSize.width === 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => fitToViewport(pageSize));
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
    applyTransform({
      scale: nextScale,
      x: centerX - (centerX - current.x) * ratio,
      y: centerY - (centerY - current.y) * ratio,
    });
  }

  function clientToPercent(clientX: number, clientY: number) {
    const layer = layerRef.current;
    if (!layer) return null;

    const rect = layer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      xPercent: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      yPercent: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  function isMarkerTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("[data-plan-marker]"));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (readOnly && !drawMode) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (isMarkerTarget(e.target)) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    });
    tapMovedRef.current = false;

    if (drawMode && !readOnly) {
      const coords = clientToPercent(e.clientX, e.clientY);
      if (coords) {
        setLiveStroke({
          points: [{ x: coords.xPercent, y: coords.yPercent }],
          color: DRAW_COLOR,
          width: DRAW_WIDTH,
        });
      }
      return;
    }

    if (pointersRef.current.size === 1 && !interactionLocked) {
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
      pinchRef.current = {
        distance: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        scale: transformRef.current.scale,
      };
      panStartRef.current = null;
      setLiveStroke(null);
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (isMarkerTarget(e.target)) return;

    const pointer = pointersRef.current.get(e.pointerId);
    if (!pointer) return;

    if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 8) {
      tapMovedRef.current = true;
    }

    pointersRef.current.set(e.pointerId, { ...pointer, x: e.clientX, y: e.clientY });

    if (drawMode && liveStroke && !readOnly) {
      const coords = clientToPercent(e.clientX, e.clientY);
      if (coords) {
        setLiveStroke({
          ...liveStroke,
          points: [...liveStroke.points, { x: coords.xPercent, y: coords.yPercent }],
        });
      }
      return;
    }

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

    if (pointersRef.current.size === 1 && panStartRef.current && !interactionLocked) {
      applyTransform({
        ...transformRef.current,
        x: panStartRef.current.tx + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.ty + (e.clientY - panStartRef.current.y),
      });
    }
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (drawMode && liveStroke && liveStroke.points.length >= 2 && onStrokesChange) {
      onStrokesChange([...strokes, liveStroke]);
    }
    setLiveStroke(null);

    if (
      pointersRef.current.size === 1 &&
      !tapMovedRef.current &&
      addMode &&
      onPlanClick
    ) {
      const coords = clientToPercent(e.clientX, e.clientY);
      if (coords) onPlanClick(coords.xPercent, coords.yPercent);
    }

    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panStartRef.current = null;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  const displayStrokes = liveStroke ? [...strokes, liveStroke] : strokes;

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
          onClick={() => fitToViewport(pageSize)}
          className="flex h-11 items-center justify-center rounded-xl bg-white/95 px-3 text-xs font-semibold text-zinc-700 shadow-md backdrop-blur active:scale-95"
        >
          Ajuster
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`relative h-full min-h-0 flex-1 touch-none overflow-hidden bg-zinc-200/80 ${
          addMode
            ? "cursor-crosshair"
            : drawMode
              ? "cursor-cell"
              : "cursor-grab active:cursor-grabbing"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-zinc-100/90">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
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
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {displayStrokes.map((stroke, index) => (
                  <path
                    key={index}
                    d={strokeToPath(stroke)}
                    fill="none"
                    stroke={stroke.color}
                    strokeWidth={stroke.width / 10}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkerClick?.(marker.id);
                    }}
                    className={`pointer-events-auto absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-110 ${
                      selectedMarkerId === marker.id
                        ? "border-white bg-amber-500 ring-4 ring-amber-300"
                        : "border-white bg-red-600"
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
