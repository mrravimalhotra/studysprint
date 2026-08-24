import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: schools }, { data: grades }, { data: subjects }] = await Promise.all([
    admin.from("schools").select("*").order("name"),
    admin.from("grades").select("*").order("name"),
    admin.from("subjects").select("*").order("name"),
  ]);

  return NextResponse.json({ schools: schools ?? [], grades: grades ?? [], subjects: subjects ?? [] });
}

interface PostBody {
  kind: "school" | "grade" | "subject";
  name: string;
  schoolId?: string; // required for grade/subject
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PostBody | null;
  if (!body?.kind || !body.name?.trim()) {
    return NextResponse.json({ error: "kind and name are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const name = body.name.trim();

  if (body.kind === "school") {
    const { data, error } = await admin.from("schools").insert({ name }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ school: data });
  }

  if (!body.schoolId) {
    return NextResponse.json({ error: "schoolId is required for grade/subject" }, { status: 400 });
  }

  const table = body.kind === "grade" ? "grades" : "subjects";
  const { data, error } = await admin.from(table).insert({ name, school_id: body.schoolId }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ [body.kind]: data });
}
