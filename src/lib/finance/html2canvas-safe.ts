import type { Options } from "html2canvas";

/** Styles sûrs (hex/rgb) pour html2canvas — évite l'erreur lab()/oklch de Tailwind v4. */
const SAFE_CANVAS_STYLES = `
  *, *::before, *::after {
    --tw-ring-color: rgb(59 130 246 / 0.5) !important;
    --tw-shadow-color: rgb(0 0 0 / 0.1) !important;
    --tw-border-opacity: 1 !important;
  }
  html, body {
    color: rgb(15, 23, 42) !important;
    background-color: rgb(255, 255, 255) !important;
  }
`;

function stripExternalStyles(clonedDoc: Document) {
  clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    node.parentNode?.removeChild(node);
  });

  const safeStyle = clonedDoc.createElement("style");
  safeStyle.textContent = SAFE_CANVAS_STYLES;
  clonedDoc.head.appendChild(safeStyle);
}

function inlineSafeColors(clonedDoc: Document) {
  const win = clonedDoc.defaultView;
  if (!win) return;

  clonedDoc.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    const computed = win.getComputedStyle(el);

    const props = [
      "color",
      "backgroundColor",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
      "outlineColor",
    ] as const;

    for (const prop of props) {
      const value = computed.getPropertyValue(
        prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
      );
      if (!value || value === "rgba(0, 0, 0, 0)" || value === "transparent") continue;
      if (/lab\(|oklch\(|lch\(|color\(/.test(value)) continue;
      try {
        el.style.setProperty(
          prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
          value
        );
      } catch {
        /* ignore unsupported props */
      }
    }
  });
}

/** Options html2canvas compatibles Tailwind v4 (sans couleurs lab()). */
export function html2canvasSafeOptions(
  base: Partial<Options> = {}
): Partial<Options> {
  const userOnClone = base.onclone;

  return {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    ...base,
    onclone: (clonedDoc, element) => {
      stripExternalStyles(clonedDoc);
      inlineSafeColors(clonedDoc);
      userOnClone?.(clonedDoc, element);
    },
  };
}
