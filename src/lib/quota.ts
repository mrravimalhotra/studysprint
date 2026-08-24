import { createAdminClient } from "@/lib/supabase/admin";

export interface QuotaStatus {
  used: number;
  quota: number;
  remaining: number;
  overQuota: boolean;
}

/** Checks a student's current-month token usage against their configured quota. */
export async function checkQuota(studentId: string): Promise<QuotaStatus> {
  const admin = createAdminClient();

  const [{ data: usedData, error: usedError }, { data: student, error: studentError }] = await Promise.all([
    admin.rpc("student_monthly_usage", { p_student_id: studentId }),
    admin.from("students").select("token_quota").eq("id", studentId).single(),
  ]);

  if (usedError) throw new Error(`Failed to read usage: ${usedError.message}`);
  if (studentError || !student) throw new Error("Student not found");

  const used = (usedData as number) ?? 0;
  const quota = student.token_quota;

  return { used, quota, remaining: Math.max(quota - used, 0), overQuota: used >= quota };
}

/** Thrown by API routes to produce a friendly 429 response when a student is over quota. */
export class QuotaExceededError extends Error {
  status: QuotaStatus;
  constructor(status: QuotaStatus) {
    super("Monthly token quota exceeded");
    this.status = status;
  }
}
