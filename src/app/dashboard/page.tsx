"use client";

import { useEffect, useState } from "react";
import type { GenerationTaskType, Student } from "@/types/database";

interface MeResponse {
  student: Student;
  quota: { used: number; quota: number; remaining: number; overQuota: boolean };
}

interface GenerationResult {
  title: string;
  text: string;
  usedSearchGrounding: boolean;
  downloadUrl: string;
  sources: { id: string; section_label: string | null; source_type: string; page_number: number | null }[];
}

const TABS: { value: GenerationTaskType; label: string; placeholder: string }[] = [
  { value: "solution", label: "Step-by-step solution", placeholder: "Paste the question you need solved..." },
  { value: "notes", label: "Revision notes", placeholder: "Which topic should the notes cover?" },
  { value: "sample_paper", label: "Sample paper", placeholder: "Which topic/syllabus scope should the paper cover?" },
  { value: "ad_hoc", label: "Ask anything", placeholder: "Ask any study-related question..." },
];

const ROUTE_BY_TASK: Record<GenerationTaskType, string> = {
  solution: "/api/generate/solution",
  notes: "/api/generate/notes",
  sample_paper: "/api/generate/sample-paper",
  ad_hoc: "/api/generate/ad-hoc",
};

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tab, setTab] = useState<GenerationTaskType>("solution");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);

  async function loadMe() {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (res.ok) setMe(data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is intentional here
    loadMe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(ROUTE_BY_TASK[tab], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data);
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  const profileIncomplete = me && (!me.student.school_id || !me.student.grade_id || me.student.subject_ids.length === 0);

  return (
    <div className="space-y-6">
      {me && (
        <QuotaBar used={me.quota.used} quota={me.quota.quota} />
      )}

      {profileIncomplete && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Your profile is missing a school, grade, or subject. Ask an admin to complete it before
          generating content.
        </p>
      )}

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={TABS.find((t) => t.value === tab)?.placeholder}
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !!profileIncomplete}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-sm font-semibold text-slate-900">{result.title}</h2>
            <a
              href={result.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Download PDF
            </a>
          </div>
          {result.usedSearchGrounding && (
            <p className="text-xs text-slate-500">
              The knowledge base didn&apos;t fully cover this — supplemented with a web search.
            </p>
          )}
          <div className="whitespace-pre-wrap text-sm text-slate-700">{result.text}</div>
          {result.sources.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500">Sources</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {result.sources.map((s, i) => (
                  <li key={s.id}>
                    [{i + 1}] {s.section_label ?? s.source_type}
                    {s.page_number ? `, p.${s.page_number}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuotaBar({ used, quota }: { used: number; quota: number }) {
  const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Monthly token usage</span>
        <span>
          {used.toLocaleString()} / {quota.toLocaleString()}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-slate-900"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
