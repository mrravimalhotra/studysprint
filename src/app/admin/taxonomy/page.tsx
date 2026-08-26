"use client";

import { useEffect, useState } from "react";
import type { Grade, School, Subject } from "@/types/database";
import { EditableName } from "@/components/EditableName";

export default function TaxonomyPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newSchool, setNewSchool] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newSubject, setNewSubject] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/taxonomy");
    const data = await res.json();
    if (res.ok) {
      setSchools(data.schools);
      setGrades(data.grades);
      setSubjects(data.subjects);
      setSelectedSchool((prev) => prev || data.schools[0]?.id || "");
    } else {
      setError(data.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is intentional here
    load();
  }, []);

  async function create(kind: "school" | "grade" | "subject", name: string, schoolId?: string) {
    setError(null);
    const res = await fetch("/api/admin/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, schoolId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    await load();
  }

  async function rename(kind: "school" | "grade" | "subject", id: string, name: string) {
    const res = await fetch("/api/admin/taxonomy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (kind === "school") setSchools((prev) => prev.map((s) => (s.id === id ? data.school : s)));
    if (kind === "grade") setGrades((prev) => prev.map((g) => (g.id === id ? data.grade : g)));
    if (kind === "subject") setSubjects((prev) => prev.map((s) => (s.id === id ? data.subject : s)));
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-slate-900">Schools & Taxonomy</h1>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Schools</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newSchool.trim()) return;
            create("school", newSchool.trim());
            setNewSchool("");
          }}
        >
          <input
            value={newSchool}
            onChange={(e) => setNewSchool(e.target.value)}
            placeholder="New school name"
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Add</button>
        </form>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {schools.map((s) => (
            <li key={s.id}>
              <EditableName value={s.name} onSave={(name) => rename("school", s.id, name)} />
            </li>
          ))}
          {schools.length === 0 && <li className="text-slate-400">No schools yet.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Grades & Subjects</h2>
        <div className="mt-3">
          <label className="text-xs font-medium text-slate-500">School</label>
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Grades</p>
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newGrade.trim() || !selectedSchool) return;
                create("grade", newGrade.trim(), selectedSchool);
                setNewGrade("");
              }}
            >
              <input
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                placeholder="e.g. Grade 9"
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Add</button>
            </form>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {grades.filter((g) => g.school_id === selectedSchool).map((g) => (
                <li key={g.id}>
                  <EditableName value={g.name} onSave={(name) => rename("grade", g.id, name)} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Subjects</p>
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSubject.trim() || !selectedSchool) return;
                create("subject", newSubject.trim(), selectedSchool);
                setNewSubject("");
              }}
            >
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Physics"
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Add</button>
            </form>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {subjects.filter((s) => s.school_id === selectedSchool).map((s) => (
                <li key={s.id}>
                  <EditableName value={s.name} onSave={(name) => rename("subject", s.id, name)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
