# StudySprint

A RAG-powered study assistant for schools: step-by-step solutions, revision
notes, sample papers, and ad-hoc Q&A — grounded first in each school's own
curriculum material, exportable to PDF, with per-student token quotas and a
provider-agnostic LLM layer (defaults to Google Gemini, swappable to
Anthropic/OpenAI per task type from the admin panel, no redeploy needed).

Built per the low-cost blueprint: Next.js on Vercel, Supabase
(Auth + Postgres/pgvector + Storage) as the only paid-at-scale infrastructure,
and Gemini's native vision for OCR instead of a dedicated OCR vendor.

## Stack

- **Frontend/Backend**: Next.js 16 (App Router), TypeScript, Tailwind CSS — deployed on Vercel
- **Auth + DB + Storage**: Supabase (Postgres + `pgvector`, bundled Auth, bundled Storage)
- **LLM**: Google Gemini by default via `src/lib/llm/`, with Anthropic/OpenAI adapters ready to swap in per task type
- **PDF export**: `@react-pdf/renderer`, rendered server-side, stored in Supabase Storage, delivered via signed URLs

## Project layout

```
src/
  app/
    (public)      login, signup, pending-approval
    dashboard/     student UI — generate content, view/download past documents
    admin/         admin UI — students, taxonomy, knowledge base uploads, LLM routing
    api/
      generate/    solution | notes | sample-paper | ad-hoc  (shared pipeline, §lib/generation)
      admin/       students, taxonomy, documents (ingestion), llm-settings
      documents/   student's own generated-document listing + signed download
      me/          current student profile + quota
  lib/
    llm/           generateCompletion() + embed() — the provider abstraction layer
    rag/           retrieveContext() — the shared vector-search core
    generation/    system prompts + the shared quota→retrieve→generate→record pipeline
    ingestion/     vision text extraction → chunking → embedding → pgvector insert
    pdf/           shared PDF renderer
    supabase/      browser/server/admin Supabase clients + middleware session refresh
    quota.ts       monthly token-quota check
    storage.ts     Supabase Storage upload + signed URL helpers
supabase/migrations/0001_init.sql   full schema: tables, RLS policies, match_chunks() / student_monthly_usage() RPCs
```

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough for a pilot).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`. This enables `pgvector`,
   creates every table, the `match_chunks`/`student_monthly_usage` RPCs, and RLS policies.
3. In Storage, create a bucket named `studysprint` (or set `SUPABASE_STORAGE_BUCKET` to
   whatever name you choose). Keep it private — all access goes through signed URLs.
4. In Authentication settings, disable "Confirm email" for faster pilot onboarding, or
   configure your SMTP provider if you want email confirmation.

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — same page (**server-only secret, never expose to the client**)
- `GOOGLE_API_KEY` — your existing Google AI Studio / Gemini API key (default runtime provider)
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — optional, only needed if you switch a task type to that provider from the admin panel

### 3. Install and run

```bash
npm install
npm run dev
```

### 4. Bootstrap the first admin

Sign up through `/signup` — this creates your account but leaves it inactive
(`students.active = false`) so a stranger can't self-grant access. For the very
first account, promote yourself directly in the Supabase SQL editor:

```sql
update students set role = 'admin', active = true where email = 'you@example.com';
```

After that, use `/admin/students` to grant/revoke access and set quotas for
everyone else — no more SQL needed.

### 5. Populate the knowledge base

In `/admin/taxonomy`, add at least one school, grade, and subject. Then in
`/admin/documents`, upload scanned/photographed pages tagged with that
taxonomy — each page is transcribed via the LLM's native vision input
(`ocr_extraction` task type, Gemini Flash by default), chunked, embedded, and
indexed into `pgvector`. Students only retrieve chunks matching their own
school/grade/subject.

Every page's original image is also kept (`chunks.image_path`, uploaded via
`src/lib/storage.ts`) and linked to its chunks — not just the OCR'd text. This
matters for anatomy diagrams, maps, and other figures where the text
transcription alone loses the actual content: when a chunk with an image is
retrieved, `runGeneration()` (`src/lib/generation/pipeline.ts`) passes that
image into the LLM call too (so the model can reference it directly, e.g. for
labeling questions), embeds it in the exported PDF, and shows it inline in the
student's on-screen result. No admin tagging is required — every uploaded page
is treated this way automatically. This is also why file storage volume scales
with pages uploaded, not just text volume — see the Storage note below.

**Storage**: Supabase's free tier caps file storage well under what a handful
of image-heavy textbooks need. If you outgrow it, swap `src/lib/storage.ts` to
Cloudflare R2 (10GB free, zero egress fees — relevant here since every
generation that cites an image re-serves it) while keeping Supabase for
Auth/Postgres/pgvector. The functions to redirect are `uploadPdf`,
`uploadSourceFile`, `downloadFile`, and `getSignedUrl`.

## Deploying

Push to GitHub and import the repo into Vercel. Set the same environment
variables there. The ingestion route (`/api/admin/documents`) sets
`maxDuration = 300` for multi-page vision extraction — this requires a Vercel
plan that allows >60s serverless functions (Pro or higher) if you upload large
documents; small uploads work fine on Hobby's default limit.

## Notes on the LLM abstraction layer

Every generation call in the app goes through `generateCompletion()`
(`src/lib/llm/index.ts`), which looks up the provider + model for that task
type from the `llm_settings` table (editable at `/admin/llm-settings`) and
routes to the matching adapter (`providers/google.ts`, `anthropic.ts`,
`openai.ts`). Every adapter returns the same normalized `{ text, usage }`
shape, so quota tracking in `token_usage` works identically regardless of
which vendor actually served a given request — switching providers for any
task type is a database write, not a code change or redeploy.
