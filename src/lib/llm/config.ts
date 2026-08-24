import { createAdminClient } from "@/lib/supabase/admin";
import type { LlmSetting, Provider, TaskType } from "@/types/database";

const FALLBACK: Record<TaskType, { provider: Provider; model: string }> = {
  ocr_extraction: { provider: "google", model: "gemini-2.5-flash" },
  embedding: { provider: "google", model: "text-embedding-004" },
  solution: { provider: "google", model: "gemini-2.5-pro" },
  notes: { provider: "google", model: "gemini-2.5-pro" },
  sample_paper: { provider: "google", model: "gemini-2.5-pro" },
  ad_hoc: { provider: "google", model: "gemini-2.5-flash" },
  coverage_check: { provider: "google", model: "gemini-2.5-flash" },
};

let cache: { at: number; rows: Map<TaskType, LlmSetting> } | null = null;
const CACHE_TTL_MS = 30_000;

/**
 * Reads provider + model routing for a task type from the admin-editable
 * `llm_settings` table, so switching providers is a DB write, not a redeploy.
 * Cached briefly per server instance to avoid a DB round trip per LLM call.
 */
export async function getLlmSetting(taskType: TaskType): Promise<{ provider: Provider; model: string }> {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_TTL_MS) {
    const admin = createAdminClient();
    const { data } = await admin.from("llm_settings").select("*");
    const rows = new Map<TaskType, LlmSetting>((data ?? []).map((r) => [r.task_type as TaskType, r as LlmSetting]));
    cache = { at: now, rows };
  }

  const row = cache.rows.get(taskType);
  if (row) return { provider: row.provider, model: row.model };
  return FALLBACK[taskType];
}

export function invalidateLlmSettingsCache() {
  cache = null;
}
