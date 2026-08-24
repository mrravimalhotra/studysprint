import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestDocument } from "@/lib/ingestion/ingest";

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
  sourceType: "textbook" | "exercise" | "past_paper" | "notes";
  pages: { imageBase64: string; mimeType: string }[];
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as UploadBody | null;
  if (!body?.title || !body.schoolId || !body.gradeId || !body.subjectId || !body.pages?.length) {
    return NextResponse.json({ error: "title, schoolId, gradeId, subjectId, and pages are required" }, { status: 400 });
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
      pages: body.pages.map((p, i) => ({ pageNumber: i + 1, imageBase64: p.imageBase64, mimeType: p.mimeType })),
    });

    return NextResponse.json({ documentId, status: "ready" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
