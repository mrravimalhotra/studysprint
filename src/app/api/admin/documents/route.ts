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

const SOURCE_TYPE_LABELS: Record<DocumentRow["source_type"], string> = {
  textbook: "Textbook",
  exercise: "Exercise",
  past_paper: "Past paper",
  notes: "Notes",
};

interface UploadPage {
  imageBase64: string;
  mimeType: string;
  sourceType: DocumentRow["source_type"];
}

interface UploadBody {
  title: string;
  schoolId: string;
  gradeId: string;
  subjectId: string;
  pages: UploadPage[];
}

/** Splits pages into contiguous runs of the same source type, preserving scan order. */
function groupByContiguousSourceType(pages: UploadPage[]): UploadPage[][] {
  const groups: UploadPage[][] = [];
  for (const page of pages) {
    const last = groups[groups.length - 1];
    if (last && last[0].sourceType === page.sourceType) {
      last.push(page);
    } else {
      groups.push([page]);
    }
  }
  return groups;
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

  // A single scan often mixes content types (e.g. a chapter followed by its
  // exercises) — group contiguous same-type pages and ingest each run as its
  // own document, rather than forcing one source_type across the whole batch.
  const groups = groupByContiguousSourceType(body.pages);

  try {
    const documentIds = await Promise.all(
      groups.map((pages, i) => {
        const title = groups.length > 1 ? `${body.title} — ${SOURCE_TYPE_LABELS[pages[0].sourceType]}` : body.title;
        return ingestDocument({
          title,
          schoolId: body.schoolId,
          gradeId: body.gradeId,
          subjectId: body.subjectId,
          sourceType: pages[0].sourceType,
          uploadedBy: admin.id,
          pages: pages.map((p, j) => ({ pageNumber: j + 1, imageBase64: p.imageBase64, mimeType: p.mimeType })),
        }).catch((err) => {
          throw new Error(`Group ${i + 1} (${SOURCE_TYPE_LABELS[pages[0].sourceType]}): ${err instanceof Error ? err.message : "ingestion failed"}`);
        });
      })
    );

    return NextResponse.json({ documentIds, status: "ready" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
