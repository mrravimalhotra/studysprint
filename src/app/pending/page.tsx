import { signOut } from "@/lib/actions/auth";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Awaiting approval</h1>
        <p className="text-sm text-slate-500">
          Your account has been created but is not yet active. An admin needs to grant you
          access — check back soon.
        </p>
        <form action={signOut}>
          <button className="text-sm font-medium text-slate-900 underline">Sign out</button>
        </form>
      </div>
    </div>
  );
}
