import { NextResponse } from "next/server";
import { getCurrentStudent } from "@/lib/auth";
import { checkQuota } from "@/lib/quota";

export async function GET() {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await checkQuota(student.id);
  return NextResponse.json({ student, quota });
}
