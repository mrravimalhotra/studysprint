import { createAdminClient } from "@/lib/supabase/admin";
import { embed } from "@/lib/llm";
import type { MatchedChunk } from "@/types/database";

export interface RetrievalScope {
  schoolId: string;
  gradeId: string;
  subjectId: string;
}

export interface RetrievalResult {
  chunks: MatchedChunk[];
  /** True when the top match's similarity is below the confidence threshold — a signal to allow search grounding. */
  coverageLow: boolean;
}

const MATCH_COUNT = 8;
const COVERAGE_THRESHOLD = 0.55;

/**
 * The reusable RAG retrieval core: embed the query, then run a taxonomy-filtered
 * vector search in pgvector via the `match_chunks` RPC. Every generation route
 * (solutions, notes, sample papers, ad-hoc) calls this same function.
 */
export async function retrieveContext(query: string, scope: RetrievalScope): Promise<RetrievalResult> {
  const { embedding } = await embed(query);
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("match_chunks", {
    query_embedding: embedding,
    match_school_id: scope.schoolId,
    match_grade_id: scope.gradeId,
    match_subject_id: scope.subjectId,
    match_count: MATCH_COUNT,
  });

  if (error) throw new Error(`Vector search failed: ${error.message}`);

  const chunks = (data ?? []) as MatchedChunk[];
  const topSimilarity = chunks[0]?.similarity ?? 0;

  return { chunks, coverageLow: chunks.length === 0 || topSimilarity < COVERAGE_THRESHOLD };
}

/** Formats retrieved chunks into a single context block for the completion prompt. */
export function formatContext(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) return "(No matching material found in the knowledge base.)";

  return chunks
    .map((c, i) => {
      const loc = [c.section_label, c.page_number ? `p.${c.page_number}` : null].filter(Boolean).join(", ");
      return `[Source ${i + 1}${loc ? ` — ${loc}` : ""} — ${c.source_type}]\n${c.content}`;
    })
    .join("\n\n");
}
