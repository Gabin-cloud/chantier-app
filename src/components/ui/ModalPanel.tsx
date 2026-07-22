"use client";

import type { ReactNode } from "react";

type ModalPanelProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "fullscreen";
};

const MAX_WIDTH: Record<Exclude<NonNullable<ModalPanelProps["maxWidth"]>, "fullscreen">, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-4xl",
};

export function ModalPanel({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "lg",
}: ModalPanelProps) {
  const isFullscreen = maxWidth === "fullscreen";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${
          isFullscreen
            ? "h-[98vh] max-h-[98vh] max-w-[98vw]"
            : `max-h-[90vh] ${MAX_WIDTH[maxWidth]}`
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {title}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className={`overflow-y-auto px-5 py-4 ${isFullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
