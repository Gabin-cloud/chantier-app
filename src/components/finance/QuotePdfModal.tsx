"use client";

type QuotePdfModalProps = {
  url: string | null;
  title: string;
  open: boolean;
  onClose: () => void;
};

export function QuotePdfModal({ url, title, open, onClose }: QuotePdfModalProps) {
  if (!open || !url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[98vh] max-h-[98vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Devis
            </p>
            <p className="mt-0.5 text-sm text-slate-700">{title}</p>
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
        <iframe src={url} title={title} className="min-h-0 flex-1 w-full bg-white" />
      </div>
    </div>
  );
}
