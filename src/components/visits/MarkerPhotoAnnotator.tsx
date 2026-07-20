"use client";

import { useEffect, useRef, useState } from "react";

type MarkerPhotoAnnotatorProps = {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
};

const PEN_COLOR = "#ef4444";
const PEN_WIDTH = 4;

export function MarkerPhotoAnnotator({
  file,
  onConfirm,
  onCancel,
}: MarkerPhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
      setReady(true);
    };

    img.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function getCanvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function startDraw(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getCanvasPoint(clientX, clientY);
    if (!ctx || !point) return;

    drawingRef.current = true;
    ctx.strokeStyle = PEN_COLOR;
    ctx.lineWidth = PEN_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function continueDraw(clientX: number, clientY: number) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getCanvasPoint(clientX, clientY);
    if (!ctx || !point) return;

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function endDraw() {
    drawingRef.current = false;
  }

  function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-semibold text-white">Annoter la photo</p>
        <p className="text-xs text-white/60">Tracez sur la photo pour marquer la réserve</p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full touch-none rounded-lg bg-black shadow-2xl"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            startDraw(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => continueDraw(e.clientX, e.clientY)}
          onPointerUp={(e) => {
            endDraw();
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              // ignore
            }
          }}
          onPointerCancel={endDraw}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-3 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white active:scale-95"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!ready}
          className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white active:scale-95 disabled:opacity-50"
        >
          Valider
        </button>
      </div>
    </div>
  );
}
