import { createAdminClient } from "@/lib/supabase/admin";
import { extractPageText } from "@/lib/ingestion/extract";
import { chunkPageText } from "@/lib/ingestion/chunk";
import { embed } from "@/lib/llm";
import type { DocumentRow } from "@/types/database";

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
  storagePath: string | null;
  pages: IngestPage[];
}

/**
 * Full ingestion pipeline for one uploaded document: vision text extraction per
 * page → chunking → embedding → pgvector insert, tagged with the taxonomy the
 * admin selected at upload time. Runs to completion or marks the document failed.
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
      storage_path: input.storagePath,
      uploaded_by: input.uploadedBy,
      status: "processing",
    })
    .select()
    .single();

  if (docError || !document) throw new Error(`Failed to create document: ${docError?.message}`);

  try {
    for (const page of input.pages) {
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
