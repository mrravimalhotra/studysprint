import { generateCompletion } from "@/lib/llm";
import { recordTokenUsage } from "@/lib/llm/usage";
import { retrieveContext, formatContext, loadSourceImages } from "@/lib/rag/retrieve";
import { checkQuota, QuotaExceededError } from "@/lib/quota";
import { systemInstructionsFor } from "@/lib/generation/prompts";
import type { CompletionImage } from "@/lib/llm/types";
import type { GenerationTaskType, MatchedChunk, Student } from "@/types/database";

export interface GenerationScope {
  schoolId: string;
  gradeId: string;
  subjectId: string;
}

export interface GenerationInput {
  student: Student;
  taskType: GenerationTaskType;
  prompt: string;
  /**
   * Admin-only: query a specific school/grade/subject instead of the caller's
   * own profile. An admin manages many schools and shouldn't be pinned to one
   * taxonomy triple just to test or generate content — a student always stays
   * scoped to their own assigned school/grade/subject, so this is rejected for
   * non-admins.
   */
  scopeOverride?: GenerationScope;
}

export interface GenerationOutput {
  text: string;
  sources: MatchedChunk[];
  /** Source image_path → loaded image, so the PDF renderer can attach the right figure to the right citation. */
  sourceImages: Map<string, CompletionImage>;
  usedSearchGrounding: boolean;
}

/**
 * Shared generation pipeline: quota check → RAG retrieval → LLM call → usage
 * recording. Every generation route (solutions, notes, sample papers, ad-hoc)
 * calls this same function, differing only in taskType (which selects the
 * system prompt and, via llm_settings, the provider/model).
 */
export async function runGeneration({
  student,
  taskType,
  prompt,
  scopeOverride,
}: GenerationInput): Promise<GenerationOutput> {
  const quota = await checkQuota(student.id);
  if (quota.overQuota) throw new QuotaExceededError(quota);

  let scope: GenerationScope;
  if (scopeOverride) {
    if (student.role !== "admin") {
      throw new Error("Only admins can generate content for a school/grade/subject other than their own.");
    }
    scope = scopeOverride;
  } else {
    if (!student.school_id || !student.grade_id) {
      throw new Error("Your profile is missing a school/grade — ask an admin to complete it.");
    }
    const subjectId = student.subject_ids[0];
    if (!subjectId) {
      throw new Error("Your profile has no subject enrolled — ask an admin to add one.");
    }
    scope = { schoolId: student.school_id, gradeId: student.grade_id, subjectId };
  }

  const retrieval = await retrieveContext(prompt, scope);

  const { images, byPath: sourceImages } = await loadSourceImages(retrieval.chunks);

  const result = await generateCompletion({
    taskType,
    systemInstructions: systemInstructionsFor(taskType),
    prompt,
    context: formatContext(retrieval.chunks),
    images,
    // Search grounding is opt-in per the RAG-first policy: only fires when
    // coverage from the knowledge base is weak.
    allowSearchGrounding: retrieval.coverageLow,
  });

  await recordTokenUsage({
    studentId: student.id,
    taskType,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
  });

  return {
    text: result.text,
    sources: retrieval.chunks,
    sourceImages,
    usedSearchGrounding: Boolean(result.usedSearchGrounding),
  };
}
