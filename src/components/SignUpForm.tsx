"use client";

import { useState } from "react";
import { signUp } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/PasswordInput";

export function SignUpForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <form action={signUp} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="full_name">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <PasswordInput
        name="password"
        label="Password"
        autoComplete="new-password"
        minLength={6}
        required
        value={password}
        onChange={setPassword}
      />

      <PasswordInput
        name="confirm_password"
        label="Confirm password"
        autoComplete="new-password"
        minLength={6}
        required
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={mismatch ? "Passwords do not match" : undefined}
      />

      <button
        type="submit"
        disabled={mismatch}
        className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Sign up
      </button>
    </form>
  );
}
