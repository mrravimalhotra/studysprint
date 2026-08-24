"use client";

import { useEffect, useState } from "react";
import type { Grade, School, Subject } from "@/types/database";

interface DocumentRowView {
  id: string;
  title: string;
  status: "processing" | "ready" | "failed";
  source_type: string;
  created_at: string;
  schools: { name: string } | null;
  grades: { name: string } | null;
  subjects: { name: string } | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocumentsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [documents, setDocuments] = useState<DocumentRowView[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sourceType, setSourceType] = useState<"textbook" | "exercise" | "past_paper" | "notes">("textbook");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [taxRes, docsRes] = await Promise.all([fetch("/api/admin/taxonomy"), fetch("/api/admin/documents")]);
    const tax = await taxRes.json();
    const docs = await docsRes.json();
    if (taxRes.ok) {
      setSchools(tax.schools);
      setGrades(tax.grades);
      setSubjects(tax.subjects);
      setSchoolId((prev) => prev || tax.schools[0]?.id || "");
    }
    if (docsRes.ok) setDocuments(docs.documents);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is intentional here
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim() || !schoolId || !gradeId || !subjectId || files.length === 0) {
      setError("Title, school, grade, subject, and at least one page image are required");
      return;
    }

    setSubmitting(true);
    try {
      const pages = await Promise.all(
        files.map(async (f) => ({ imageBase64: await fileToBase64(f), mimeType: f.type || "image/jpeg" }))
      );
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), schoolId, gradeId, subjectId, sourceType, pages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Uploaded and indexed "${title}" (${pages.length} page${pages.length > 1 ? "s" : ""}).`);
      setTitle("");
      setFiles([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Knowledge Base</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload scanned/photographed pages. Each is read directly via the LLM&apos;s vision
          input (no separate OCR bill), chunked, embedded, and indexed into pgvector — tagged
          by school, grade, and subject so retrieval stays scoped correctly.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

        <div>
          <label className="text-xs font-medium text-slate-500">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Physics Grade 9 — Chapter 3: Motion"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-slate-500">School</label>
            <select
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value);
                setGradeId("");
                setSubjectId("");
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Grade</label>
            <select
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              disabled={!schoolId}
            >
              <option value="">Select</option>
              {grades.filter((g) => g.school_id === schoolId).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              disabled={!schoolId}
            >
              <option value="">Select</option>
              {subjects.filter((s) => s.school_id === schoolId).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Source type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="textbook">Textbook</option>
              <option value="exercise">Exercise</option>
              <option value="past_paper">Past paper</option>
              <option value="notes">Notes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500">Page images (JPG/PNG, up to 30)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="mt-1 block w-full text-sm"
          />
          {files.length > 0 && <p className="mt-1 text-xs text-slate-500">{files.length} page(s) selected</p>}
        </div>

        <button
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Uploading & indexing..." : "Upload & index"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Taxonomy</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-900">{d.title}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {d.schools?.name} · {d.grades?.name} · {d.subjects?.name}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{d.source_type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.status === "ready"
                        ? "bg-emerald-50 text-emerald-700"
                        : d.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No documents uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
