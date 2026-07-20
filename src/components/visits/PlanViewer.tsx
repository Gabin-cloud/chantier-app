"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getPlanPdfData } from "@/lib/actions/plans";
import type { ControlResult, DrawingStroke, MarkerStatus } from "@/lib/types/database";
import { markerControlHex } from "@/lib/types/database";

export type PlanViewerMarker = {
  id: string;
  x_percent: number;
  y_percent: number;
  marker_number: number;
  control_result?: ControlResult | null;
  status?: MarkerStatus;
};

type Size = { width: number; height: number };
type Pan = { x: number; y: number };

type PlanViewerProps = {
  projectId: string;
  planId: string;
  addMode?: boolean;
  drawMode?: boolean;
  drawColor?: string;
  drawWidth?: number;
  markers: PlanViewerMarker[];
  strokes?: DrawingStroke[];
  onStrokesChange?: (strokes: DrawingStroke[]) => void;
  selectedMarkerId?: string | null;
  onPlanClick?: (xPercent: number, yPercent: number) => void;
  onMarkerClick?: (markerId: string) => void;
  readOnly?: boolean;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const MAX_CANVAS_SIDE = 8192;
const ZOOM_RENDER_DEBOUNCE_MS = 180;
const PINCH_ZOOM_SENSITIVITY = 0.38;
const PDF_WORKER_SRC = "/pdf.worker.legacy.min.mjs";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function strokeToPath(stroke: DrawingStroke) {
  if (stroke.points.length === 0) return "";
  const [first, ...rest] = stroke.points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}

function isBenignRenderError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("abort") ||
    message.includes("multiple render")
  );
}

function formatPlanError(err: unknown) {
  if (!(err instanceof Error)) {
    return "Impossible d'afficher le plan PDF.";
  }

  const message = err.message.trim();
  if (isBenignRenderError(err)) {
    return "Impossible d'afficher le plan PDF.";
  }
  if (
    message.length > 180 ||
    message.includes("=>") ||
    message.includes("this.#")
  ) {
    return "Le lecteur PDF n'a pas pu démarrer sur cet appareil.";
  }

  return message;
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function PlanViewer({
  projectId,
  planId,
  addMode = false,
  drawMode = false,
  drawColor = "#f59e0b",
  drawWidth = 2.5,
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
  const renderTaskRef = useRef<import("pdfjs-dist").RenderTask | null>(null);
  const renderGenerationRef = useRef(0);
  const pinchActiveRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const transformLayerRef = useRef<HTMLDivElement>(null);
  const activeGestureRef = useRef<"none" | "pan" | "pinch" | "draw">("none");

  const basePageSizeRef = useRef<Size>({ width: 0, height: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef<Pan>({ x: 0, y: 0 });

  const [basePageSize, setBasePageSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [liveStroke, setLiveStroke] = useState<DrawingStroke | null>(null);

  const pointersRef = useRef(
    new Map<number, { x: number; y: number; startX: number; startY: number }>()
  );
  const pinchRef = useRef<{
    distance: number;
    midX: number;
    midY: number;
  } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null
  );
  const tapMovedRef = useRef(false);

  const applyZoom = useCallback((nextZoom: number) => {
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    zoomRef.current = clamped;
    setZoom(clamped);
  }, []);

  const applyPan = useCallback((nextPan: Pan) => {
    panRef.current = nextPan;
    setPan(nextPan);
  }, []);

  const syncLayerTransform = useCallback((nextPan: Pan) => {
    const layer = transformLayerRef.current;
    if (!layer) return;
    layer.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0)`;
  }, []);

  const commitGesture = useCallback(() => {
    setPan(panRef.current);
    setZoom(zoomRef.current);
    syncLayerTransform(panRef.current);
  }, [syncLayerTransform]);

  const fitToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    const base = basePageSizeRef.current;
    if (!viewport || base.width === 0) return;

    const padding = 12;
    const vw = viewport.clientWidth - padding * 2;
    const vh = viewport.clientHeight - padding * 2;
    const nextZoom = clamp(Math.min(vw / base.width, vh / base.height), MIN_ZOOM, MAX_ZOOM);

    applyZoom(nextZoom);
    applyPan({
      x: (viewport.clientWidth - base.width * nextZoom) / 2,
      y: (viewport.clientHeight - base.height * nextZoom) / 2,
    });
  }, [applyPan, applyZoom]);

  const cancelActiveRender = useCallback(async () => {
    const task = renderTaskRef.current;
    if (!task) return;

    renderTaskRef.current = null;
    task.cancel();

    try {
      await task.promise;
    } catch {
      // Rendu annulé volontairement avant un nouveau zoom.
    }
  }, []);

  const renderPdf = useCallback(
    async (targetZoom: number) => {
      const page = pageRef.current;
      const canvas = canvasRef.current;
      const base = basePageSizeRef.current;
      if (!page || !canvas || base.width === 0) return;

      await cancelActiveRender();

      const generation = ++renderGenerationRef.current;
      setRendering(true);

      try {
        const dpr = Math.min(window.devicePixelRatio || 1, 4);
        let renderScale = targetZoom * dpr;
        const maxBaseSide = Math.max(base.width, base.height);
        if (maxBaseSide * renderScale > MAX_CANVAS_SIDE) {
          renderScale = MAX_CANVAS_SIDE / maxBaseSide;
        }

        const viewport = page.getViewport({ scale: renderScale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${base.width * targetZoom}px`;
        canvas.style.height = `${base.height * targetZoom}px`;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D indisponible.");

        const task = page.render({
          canvasContext: context,
          viewport,
          canvas,
        });
        renderTaskRef.current = task;

        await task.promise;

        if (generation === renderGenerationRef.current) {
          renderTaskRef.current = null;
          setRendering(false);
          setError(null);
        }
      } catch (err) {
        if (generation !== renderGenerationRef.current || isBenignRenderError(err)) {
          if (generation === renderGenerationRef.current) {
            setRendering(false);
          }
          return;
        }

        setRendering(false);
        setError(formatPlanError(err));
      }
    },
    [cancelActiveRender]
  );

  useEffect(() => {
    let cancelled = false;
    pageRef.current = null;
    initialFitDoneRef.current = false;
    setPdfReady(false);
    setLoading(true);
    setError(null);
    setBasePageSize({ width: 0, height: 0 });
    basePageSizeRef.current = { width: 0, height: 0 };

    async function loadPdf() {
      try {
        const base64 = await getPlanPdfData(projectId, planId);
        if (cancelled) return;

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

        const pdf = await pdfjs.getDocument({
          data: base64ToBytes(base64),
          useSystemFonts: true,
        }).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        pageRef.current = page;
        const size = { width: viewport.width, height: viewport.height };
        basePageSizeRef.current = size;
        setBasePageSize(size);
        setPdfReady(true);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(formatPlanError(err));
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      renderGenerationRef.current += 1;
      void cancelActiveRender();
    };
  }, [projectId, planId, cancelActiveRender]);

  useEffect(() => {
    if (!pdfReady || initialFitDoneRef.current) return;
    fitToViewport();
    initialFitDoneRef.current = true;
  }, [pdfReady, fitToViewport]);

  useEffect(() => {
    if (!pdfReady || zoom <= 0) return;
    if (pinchActiveRef.current) return;

    const timer = window.setTimeout(() => {
      void renderPdf(zoom);
    }, ZOOM_RENDER_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [pdfReady, zoom, renderPdf]);

  useEffect(() => {
    if (!pdfReady) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Suivre la taille du viewport sans recentrer/dézoomer : l'ouverture du
    // formulaire pastille réduisait la hauteur et déclenchait un fitToViewport.
    const observer = new ResizeObserver(() => {
      viewportSizeRef.current = {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      };
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, [pdfReady]);

  function zoomBy(factor: number) {
    const viewport = viewportRef.current;
    const base = basePageSizeRef.current;
    if (!viewport || base.width === 0) return;

    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;
    const nextZoom = clamp(currentZoom * factor, MIN_ZOOM, MAX_ZOOM);
    const ratio = nextZoom / currentZoom;

    applyZoom(nextZoom);
    applyPan({
      x: centerX - (centerX - currentPan.x) * ratio,
      y: centerY - (centerY - currentPan.y) * ratio,
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
    if (activeGestureRef.current === "none" && isMarkerTarget(e.target)) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    });
    tapMovedRef.current = false;

    if (drawMode && !readOnly && pointersRef.current.size === 1) {
      activeGestureRef.current = "draw";
      const coords = clientToPercent(e.clientX, e.clientY);
      if (coords) {
        setLiveStroke({
          points: [{ x: coords.xPercent, y: coords.yPercent }],
          color: drawColor,
          width: drawWidth,
        });
      }
      return;
    }

    if (pointersRef.current.size === 1 && !drawMode) {
      activeGestureRef.current = "pan";
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        px: panRef.current.x,
        py: panRef.current.y,
      };
    }

    if (pointersRef.current.size === 2) {
      activeGestureRef.current = "pinch";
      pinchActiveRef.current = true;
      const pts = [...pointersRef.current.values()];
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchRef.current = {
        distance: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        midX,
        midY,
      };
      panStartRef.current = null;
      setLiveStroke(null);
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (
      activeGestureRef.current === "none" &&
      isMarkerTarget(e.target)
    ) {
      return;
    }

    const pointer = pointersRef.current.get(e.pointerId);
    if (!pointer) return;

    if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 6) {
      tapMovedRef.current = true;
    }

    pointersRef.current.set(e.pointerId, { ...pointer, x: e.clientX, y: e.clientY });

    if (
      activeGestureRef.current === "draw" &&
      drawMode &&
      liveStroke &&
      !readOnly &&
      pointersRef.current.size === 1
    ) {
      const coords = clientToPercent(e.clientX, e.clientY);
      if (coords) {
        setLiveStroke({
          ...liveStroke,
          points: [...liveStroke.points, { x: coords.xPercent, y: coords.yPercent }],
        });
      }
      return;
    }

    if (activeGestureRef.current === "pinch" && pointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const distance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      if (pinchRef.current.distance > 0) {
        const distRatio = distance / pinchRef.current.distance;
        const zoomFactor = 1 + (distRatio - 1) * PINCH_ZOOM_SENSITIVITY;
        const nextZoom = clamp(zoomRef.current * zoomFactor, MIN_ZOOM, MAX_ZOOM);
        const ratio = nextZoom / zoomRef.current;

        zoomRef.current = nextZoom;
        panRef.current = {
          x: midX - (midX - panRef.current.x) * ratio,
          y: midY - (midY - panRef.current.y) * ratio,
        };
        syncLayerTransform(panRef.current);
        const layer = transformLayerRef.current;
        if (layer && basePageSizeRef.current.width > 0) {
          const base = basePageSizeRef.current;
          layer.style.width = `${base.width * nextZoom}px`;
          layer.style.height = `${base.height * nextZoom}px`;
        }
      }

      pinchRef.current = { distance, midX, midY };
      return;
    }

    if (activeGestureRef.current === "pan" && pointersRef.current.size === 1 && panStartRef.current) {
      const nextPan = {
        x: panStartRef.current.px + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.py + (e.clientY - panStartRef.current.y),
      };
      panRef.current = nextPan;
      syncLayerTransform(nextPan);
    }
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (drawMode && liveStroke && liveStroke.points.length >= 2 && onStrokesChange) {
      onStrokesChange([...strokes, liveStroke]);
    }
    setLiveStroke(null);

    const wasTap = !tapMovedRef.current;
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size === 0 && wasTap && addMode && onPlanClick) {
      const coords = clientToPercent(e.clientX, e.clientY);
      if (coords) onPlanClick(coords.xPercent, coords.yPercent);
    }

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
      if (pinchActiveRef.current) {
        pinchActiveRef.current = false;
        commitGesture();
        void renderPdf(zoomRef.current);
      }
    }

    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      if (activeGestureRef.current === "pan") {
        commitGesture();
      }
      activeGestureRef.current = "none";
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  const displayStrokes = liveStroke ? [...strokes, liveStroke] : strokes;
  const layerWidth = basePageSize.width * zoom;
  const layerHeight = basePageSize.height * zoom;

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
          onClick={fitToViewport}
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
            <p className="text-sm font-medium text-zinc-600">Chargement du PDF…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-red-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-800">Plan indisponible</p>
            <p className="max-w-sm text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                void renderPdf(zoomRef.current);
              }}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white active:scale-95"
            >
              Réessayer
            </button>
          </div>
        )}

        {rendering && !loading && !error && (
          <div className="absolute right-3 bottom-3 z-20 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow">
            Affinage du zoom…
          </div>
        )}

        {basePageSize.width > 0 && !error && (
          <div
            ref={transformLayerRef}
            className="absolute left-0 top-0 will-change-transform"
            style={{
              width: layerWidth,
              height: layerHeight,
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
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
                {markers.map((marker) => {
                  const isSelected = selectedMarkerId === marker.id;
                  return (
                    <button
                      key={marker.id}
                      type="button"
                      data-plan-marker
                      style={{
                        left: `${marker.x_percent}%`,
                        top: `${marker.y_percent}%`,
                        backgroundColor: markerControlHex(
                          marker.control_result,
                          marker.status
                        ),
                      }}
                      onClick={(e) => {
                      e.stopPropagation();
                      onMarkerClick?.(marker.id);
                    }}
                    className={`pointer-events-auto absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-110 ${
                      isSelected
                        ? "border-white ring-4 ring-amber-300"
                        : "border-white"
                    }`}
                  >
                    {marker.marker_number}
                  </button>
                );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
