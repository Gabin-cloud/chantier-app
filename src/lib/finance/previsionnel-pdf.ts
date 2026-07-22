"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { html2canvasSafeOptions } from "@/lib/finance/html2canvas-safe";

export async function exportPrevisionnelPdf({
  element,
  fileName,
}: {
  element: HTMLElement;
  fileName: string;
}) {
  const canvas = await html2canvas(
    element,
    html2canvasSafeOptions({
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    })
  );

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("l", "mm", "a4");
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

  pdf.save(fileName);
}
