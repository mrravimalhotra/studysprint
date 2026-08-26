// The "legacy" build (not the default package-root export) is the variant meant
// to run safely wherever it's evaluated, including Next.js's server-side render
// pass of this client component — the default build logs a Node-environment
// warning in that case even though pdfToPageImages itself only ever runs in
// the browser, invoked from a file-input change handler.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Rendered once per uploaded PDF, entirely client-side — the worker file is a
// static copy of node_modules/pdfjs-dist/build/pdf.worker.min.mjs in /public
// (re-copy it if pdfjs-dist is ever upgraded).
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const RENDER_SCALE = 2; // higher = crisper text for OCR, at a larger payload

export interface RasterizedPage {
  imageBase64: string;
  mimeType: string;
}

/**
 * Rasterizes every page of a PDF into a JPEG image in the browser, so a PDF
 * upload can feed the same per-page pipeline as directly-selected page images
 * — the server and ingestion code never need to know a PDF was involved.
 */
export async function pdfToPageImages(file: File): Promise<RasterizedPage[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: RasterizedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvas, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    pages.push({ imageBase64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" });
  }

  return pages;
}
