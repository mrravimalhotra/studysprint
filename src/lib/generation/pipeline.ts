import { generateCompletion } from "@/lib/llm";
import { recordTokenUsage } from "@/lib/llm/usage";
import { retrieveContext, formatContext } from "@/lib/rag/retrieve";
import { checkQuota, QuotaExceededError } from "@/lib/quota";
import { systemInstructionsFor } from "@/lib/generation/prompts";
import type { GenerationTaskType, MatchedChunk, Student } from "@/types/database";

export interface GenerationInput {
  student: Student;
  taskType: GenerationTaskType;
  prompt: string;
}

export interface GenerationOutput {
  text: string;
  sources: MatchedChunk[];
  usedSearchGrounding: boolean;
}

/**
 * Shared generation pipeline: quota check → RAG retrieval → LLM call → usage
 * recording. Every generation route (solutions, notes, sample papers, ad-hoc)
 * calls this same function, differing only in taskType (which selects the
 * system prompt and, via llm_settings, the provider/model).
 */
export async function runGeneration({ student, taskType, prompt }: GenerationInput): Promise<GenerationOutput> {
  const quota = await checkQuota(student.id);
  if (quota.overQuota) throw new QuotaExceededError(quota);

  if (!student.school_id || !student.grade_id) {
    throw new Error("Your profile is missing a school/grade — ask an admin to complete it.");
  }

  const subjectId = student.subject_ids[0];
  if (!subjectId) {
    throw new Error("Your profile has no subject enrolled — ask an admin to add one.");
  }

  const retrieval = await retrieveContext(prompt, {
    schoolId: student.school_id,
    gradeId: student.grade_id,
    subjectId,
  });

  const result = await generateCompletion({
    taskType,
    systemInstructions: systemInstructionsFor(taskType),
    prompt,
    context: formatContext(retrieval.chunks),
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
    usedSearchGrounding: Boolean(result.usedSearchGrounding),
  };
}
