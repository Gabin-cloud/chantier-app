"use client";

import { useMemo, useState } from "react";

export function useTrackedForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(saved),
    [values, saved]
  );

  function set<K extends keyof T>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function markSaved(next?: T) {
    const snapshot = next ?? values;
    setSaved(snapshot);
    setValues(snapshot);
  }

  function reset() {
    setValues(saved);
  }

  return {
    values,
    saved,
    set,
    setValues,
    markSaved,
    reset,
    isDirty,
  };
}
