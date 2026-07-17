"use client";

import { useRef, useState } from "react";

type AdminPieceFileAttachProps = {
  disabled?: boolean;
  isPending?: boolean;
  fileName?: string | null;
  /** true = DANOBAT joint un fichier pour contrôle (sans workflow « dépôt entreprise »). */
  managerMode?: boolean;
  onFile: (file: File) => void;
};

export function AdminPieceFileAttach({
  disabled,
  isPending,
  fileName,
  managerMode = false,
  onFile,
}: AdminPieceFileAttachProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFile(file: File | undefined) {
    if (!file || disabled || isPending) return;
    onFile(file);
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        pickFile(e.dataTransfer.files?.[0]);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`min-w-[11rem] cursor-pointer rounded-lg border border-dashed px-3 py-2 text-center transition-colors ${
        dragOver
          ? "border-slate-400 bg-slate-100"
          : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        disabled={disabled || isPending}
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <p className="text-xs font-semibold text-slate-700">
        {isPending
          ? "Envoi en cours…"
          : managerMode
            ? "Ajouter / remplacer le fichier"
            : "Glisser ou cliquer pour déposer"}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {fileName ? `Actuel : ${fileName}` : "PDF, Word, image…"}
      </p>
    </div>
  );
}
