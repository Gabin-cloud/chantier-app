"use client";

import { useState } from "react";
import { QuickFileSortPopup } from "@/components/finance/QuickFileSortPopup";

type QuickFileSortFabProps = {
  projectId: string;
};

export function QuickFileSortFab({ projectId }: QuickFileSortFabProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Classer un fichier reçu"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-700 active:scale-95"
        aria-label="Classer un fichier reçu par mail"
      >
        <span aria-hidden>📥</span>
      </button>

      {open && (
        <QuickFileSortPopup
          projectId={projectId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
