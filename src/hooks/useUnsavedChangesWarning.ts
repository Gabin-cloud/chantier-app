"use client";

import { useEffect } from "react";

export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}

export function confirmLeaveIfDirty(isDirty: boolean): boolean {
  if (!isDirty) return true;
  return window.confirm(
    "Des modifications n'ont pas été enregistrées.\n\nVoulez-vous quitter sans enregistrer ?"
  );
}
