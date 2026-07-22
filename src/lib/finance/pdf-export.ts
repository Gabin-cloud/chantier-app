"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";
import { html2canvasSafeOptions } from "@/lib/finance/html2canvas-safe";

export async function exportMergedSituationPdf({
  certificateElement,
  invoiceUrl,
  invoiceIsPdf,
  fileName,
}: {
  certificateElement: HTMLElement;
  invoiceUrl?: string | null;
  invoiceIsPdf?: boolean;
  fileName: string;
}) {
  const canvas = await html2canvas(
    certificateElement,
    html2canvasSafeOptions({ scale: 2, useCORS: true, backgroundColor: "#ffffff" })
  );

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const certificateBytes = pdf.output("arraybuffer");

  if (!invoiceUrl) {
    pdf.save(fileName);
    return;
  }

  const merged = await PDFDocument.create();
  const certDoc = await PDFDocument.load(certificateBytes);
  const certPages = await merged.copyPages(certDoc, certDoc.getPageIndices());
  certPages.forEach((page) => merged.addPage(page));

  const invoiceResponse = await fetch(invoiceUrl);
  const invoiceBytes = await invoiceResponse.arrayBuffer();

  if (invoiceIsPdf) {
    const invoiceDoc = await PDFDocument.load(invoiceBytes);
    const invoicePages = await merged.copyPages(
      invoiceDoc,
      invoiceDoc.getPageIndices()
    );
    invoicePages.forEach((page) => merged.addPage(page));
  } else {
    const imageExt = invoiceUrl.toLowerCase().includes(".png") ? "png" : "jpg";
    const page = merged.addPage([595, 842]);
    const image =
      imageExt === "png"
        ? await merged.embedPng(invoiceBytes)
        : await merged.embedJpg(invoiceBytes);
    const dims = image.scaleToFit(520, 760);
    page.drawImage(image, {
      x: 40,
      y: 842 - dims.height - 40,
      width: dims.width,
      height: dims.height,
    });
  }

  const mergedBytes = await merged.save();
  const blob = new Blob([mergedBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
