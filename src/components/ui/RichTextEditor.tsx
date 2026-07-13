"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const FONT_OPTIONS = [
  { label: "Segoe UI", value: "Segoe UI" },
  { label: "Arial", value: "Arial" },
  { label: "Calibri", value: "Calibri" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Verdana", value: "Verdana" },
];

const SIZE_OPTIONS = ["10", "12", "14", "16", "18", "24"];

export type RichTextEditorHandle = {
  insertToken: (token: string) => void;
  focus: () => void;
  getHtml: () => string;
};

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: string;
  placeholder?: string;
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    { value, onChange, disabled = false, minHeight = "180px", placeholder },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef(value);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      if (editor.innerHTML !== value && value !== lastValueRef.current) {
        editor.innerHTML = value || "";
        lastValueRef.current = value;
      }
    }, [value]);

    function emitChange() {
      const editor = editorRef.current;
      if (!editor) return;
      const html = editor.innerHTML;
      lastValueRef.current = html;
      onChange(html);
    }

    function runCommand(command: string, commandValue?: string) {
      if (disabled) return;
      editorRef.current?.focus();
      document.execCommand(command, false, commandValue);
      emitChange();
    }

    function insertToken(token: string) {
      if (disabled) return;
      editorRef.current?.focus();
      document.execCommand("insertText", false, token);
      emitChange();
    }

    useImperativeHandle(ref, () => ({
      insertToken,
      focus: () => editorRef.current?.focus(),
      getHtml: () => editorRef.current?.innerHTML ?? "",
    }));

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <select
            disabled={disabled}
            defaultValue="Segoe UI"
            onChange={(e) => runCommand("fontName", e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
            aria-label="Police"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          <select
            disabled={disabled}
            defaultValue="4"
            onChange={(e) => runCommand("fontSize", e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
            aria-label="Taille"
          >
            {SIZE_OPTIONS.map((size, index) => (
              <option key={size} value={String(index + 1)}>
                {size}px
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-xs text-slate-600">
            Couleur
            <input
              type="color"
              disabled={disabled}
              defaultValue="#1f2937"
              onChange={(e) => runCommand("foreColor", e.target.value)}
              className="h-7 w-8 cursor-pointer rounded border border-slate-200 bg-white"
            />
          </label>

          <button
            type="button"
            disabled={disabled}
            onClick={() => runCommand("bold")}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            G
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => runCommand("italic")}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs italic text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            I
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => runCommand("underline")}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs underline text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            S
          </button>
        </div>

        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          className="min-w-0 px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none [&:empty]:before:pointer-events-none [&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)]"
          style={{ minHeight }}
          data-placeholder={placeholder ?? "Rédigez votre texte ici…"}
        />
      </div>
    );
  }
);
