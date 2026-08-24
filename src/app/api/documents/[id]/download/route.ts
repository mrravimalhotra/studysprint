import { NextResponse } from "next/server";
import { getCurrentStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedUrl } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: doc, error } = await admin.from("generated_documents").select("*").eq("id", id).single();

  if (error || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.student_id !== student.id && student.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = await getSignedUrl(doc.storage_path);
  return NextResponse.json({ url });
}
