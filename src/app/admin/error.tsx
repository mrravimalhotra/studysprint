"use client";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <p className="text-sm font-medium text-red-700">Something went wrong loading this admin page.</p>
      <p className="mt-1 text-xs text-red-600">{error.message}</p>
      <button onClick={reset} className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white">
        Try again
      </button>
    </div>
  );
}
