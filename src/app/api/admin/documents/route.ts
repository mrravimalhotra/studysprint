import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestDocument } from "@/lib/ingestion/ingest";
import type { DocumentRow } from "@/types/database";

export const maxDuration = 300; // vision extraction + embedding per page can take a while

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("documents")
    .select("*, schools(name), grades(name), subjects(name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

interface UploadBody {
  title: string;
  schoolId: string;
  gradeId: string;
  subjectId: string;
  sourceType: DocumentRow["source_type"];
  pages: { imageBase64: string; mimeType: string }[];
  /** Present from the 2nd request onward when a large upload is split into batches — appends to that document instead of creating a new one. */
  documentId?: string;
  /** Page numbering offset for this batch within its document. Defaults to 1. */
  startPageNumber?: number;
  /** Whether this batch is the last one for its document (marks it "ready"). Defaults to true — the caller sets false on every batch except the final one when splitting uploads. */
  finalize?: boolean;
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UploadBody | null;
  try {
    body = (await request.json()) as UploadBody;
  } catch (err) {
    // A parse failure here almost always means the payload was too large or the
    // connection was cut mid-upload — surface that instead of a misleading
    // "missing fields" message that hides the real cause.
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Could not read the upload — it may be too large. (${message})` },
      { status: 400 }
    );
  }

  if (!body?.title || !body.schoolId || !body.gradeId || !body.subjectId || !body.sourceType || !body.pages?.length) {
    return NextResponse.json(
      { error: "title, schoolId, gradeId, subjectId, sourceType, and pages are required" },
      { status: 400 }
    );
  }
  if (body.pages.length > 30) {
    return NextResponse.json({ error: "Upload at most 30 pages per document" }, { status: 400 });
  }

  try {
    const documentId = await ingestDocument({
      title: body.title,
      schoolId: body.schoolId,
      gradeId: body.gradeId,
      subjectId: body.subjectId,
      sourceType: body.sourceType,
      uploadedBy: admin.id,
      documentId: body.documentId,
      finalize: body.finalize,
      pages: body.pages.map((p, i) => ({
        pageNumber: (body.startPageNumber ?? 1) + i,
        imageBase64: p.imageBase64,
        mimeType: p.mimeType,
      })),
    });

    return NextResponse.json({ documentId, status: body.finalize === false ? "processing" : "ready" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
