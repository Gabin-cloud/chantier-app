"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSortForm } from "@/components/finance/FileSortForm";
import { ModalPanel } from "@/components/ui/ModalPanel";

type QuickFileSortPopupProps = {
  projectId: string;
  onClose: () => void;
};

export function QuickFileSortPopup({
  projectId,
  onClose,
}: QuickFileSortPopupProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(f: File) {
    setFile(f);
  }

  return (
    <ModalPanel
      title="Classer un fichier reçu"
      subtitle="Glissez un fichier mail ou choisissez une catégorie pour le ranger"
      onClose={onClose}
      maxWidth="lg"
    >
      <div className="space-y-5">
        <section>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) handleFile(dropped);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-blue-400 bg-blue-50"
                : file
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {file ? (
              <div>
                <p className="font-medium text-emerald-800">{file.name}</p>
                <p className="mt-1 text-xs text-emerald-600">
                  Cliquez pour changer de fichier
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Glissez un fichier ici
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PDF, images, Word, Excel
                </p>
              </div>
            )}
          </div>
        </section>

        {file && (
          <FileSortForm
            projectId={projectId}
            file={file}
            onSuccess={() => {
              setFile(null);
              router.refresh();
            }}
          />
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>
      </div>
    </ModalPanel>
  );
}
