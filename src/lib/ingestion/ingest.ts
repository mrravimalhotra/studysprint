import { createAdminClient } from "@/lib/supabase/admin";
import { extractPageText } from "@/lib/ingestion/extract";
import { chunkPageText } from "@/lib/ingestion/chunk";
import { embed } from "@/lib/llm";
import { uploadSourceFile } from "@/lib/storage";
import type { DocumentRow } from "@/types/database";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface IngestPage {
  pageNumber: number;
  imageBase64: string;
  mimeType: string;
}

export interface IngestDocumentInput {
  title: string;
  schoolId: string;
  gradeId: string;
  subjectId: string;
  sourceType: DocumentRow["source_type"];
  uploadedBy: string;
  pages: IngestPage[];
}

/**
 * Full ingestion pipeline for one uploaded document: vision text extraction per
 * page → chunking → embedding → pgvector insert, tagged with the taxonomy the
 * admin selected at upload time. Every page's image is also persisted and linked
 * to its chunks — text alone loses diagrams/maps/figures, so retrieval and
 * generation need the original image, not just its OCR'd caption. Runs to
 * completion or marks the document failed.
 */
export async function ingestDocument(input: IngestDocumentInput): Promise<string> {
  const admin = createAdminClient();

  const { data: document, error: docError } = await admin
    .from("documents")
    .insert({
      title: input.title,
      school_id: input.schoolId,
      grade_id: input.gradeId,
      subject_id: input.subjectId,
      source_type: input.sourceType,
      storage_path: null,
      uploaded_by: input.uploadedBy,
      status: "processing",
    })
    .select()
    .single();

  if (docError || !document) throw new Error(`Failed to create document: ${docError?.message}`);

  try {
    for (const page of input.pages) {
      const ext = MIME_EXTENSIONS[page.mimeType] ?? "bin";
      const imagePath = `sources/${document.id}/page-${page.pageNumber}.${ext}`;
      await uploadSourceFile(imagePath, Buffer.from(page.imageBase64, "base64"), page.mimeType);

      if (page.pageNumber === 1) {
        await admin.from("documents").update({ storage_path: imagePath }).eq("id", document.id);
      }

      const pageText = await extractPageText(page.imageBase64, page.mimeType);
      const textChunks = chunkPageText(pageText, page.pageNumber);

      for (const chunk of textChunks) {
        const { embedding } = await embed(chunk.content);
        const { error: insertError } = await admin.from("chunks").insert({
          document_id: document.id,
          school_id: input.schoolId,
          grade_id: input.gradeId,
          subject_id: input.subjectId,
          source_type: input.sourceType,
          page_number: page.pageNumber,
          section_label: chunk.sectionLabel,
          content: chunk.content,
          image_path: imagePath,
          embedding,
        });
        if (insertError) throw new Error(`Failed to insert chunk: ${insertError.message}`);
      }
    }

    await admin.from("documents").update({ status: "ready" }).eq("id", document.id);
  } catch (err) {
    await admin.from("documents").update({ status: "failed" }).eq("id", document.id);
    throw err;
  }

  return document.id as string;
}
