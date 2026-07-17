"use client";

import { useCallback, useEffect, useState } from "react";

export function useWordDocument() {
  const [ready, setReady] = useState(false);
  const [outsideWord, setOutsideWord] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function init() {
      if (typeof Office === "undefined") {
        setOutsideWord(true);
        return;
      }

      Office.onReady((info) => {
        if (info.host !== Office.HostType.Word) {
          setOutsideWord(true);
          return;
        }

        if (typeof Word === "undefined") {
          setError("API Word indisponible dans ce volet.");
          return;
        }

        setReady(true);
      });
    }

    init();
  }, []);

  const insertLabelAtSelection = useCallback(async (key: string) => {
    const token = `{{${key}}}`;
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.insertText(token, Word.InsertLocation.Replace);
      await context.sync();
    });
  }, []);

  const fillDocumentLabels = useCallback(async (values: Record<string, string>) => {
    await Word.run(async (context) => {
      for (const [key, value] of Object.entries(values)) {
        const token = `{{${key}}}`;
        const results = context.document.body.search(token, {
          matchCase: false,
          matchWholeWord: false,
        });
        results.load("items");
        await context.sync();

        for (const range of results.items) {
          range.insertText(value, Word.InsertLocation.Replace);
        }
        await context.sync();
      }
    });
  }, []);

  return {
    ready,
    outsideWord,
    error,
    insertLabelAtSelection,
    fillDocumentLabels,
  };
}
