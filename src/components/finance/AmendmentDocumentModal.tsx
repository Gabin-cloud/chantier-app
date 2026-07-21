"use client";

type AmendmentDocumentModalProps = {
  html: string | null;
  title: string;
  open: boolean;
  onClose: () => void;
};

export function AmendmentDocumentModal({
  html,
  title,
  open,
  onClose,
}: AmendmentDocumentModalProps) {
  if (!open || !html) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <div
            className="mx-auto max-w-[210mm] bg-white"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
