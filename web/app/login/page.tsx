"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isRegister && name.trim().length < 2) return setError("Please enter your full name.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setBusy(true);
    try {
      const { error } = isRegister ? await signUp.email({ email, password, name: name.trim() }) : await signIn.email({ email, password });
      if (error) {
        setError(error.message || "Authentication failed.");
        return;
      }
      router.push(next);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-border bg-bg p-3 text-body text-fg shadow-sm transition focus:border-brand-400";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-black text-white shadow-brand">V</span>
        <span className="text-lead font-extrabold text-fg">EthioVin</span>
      </Link>

      <div className="card p-7">
        <h1 className="text-center text-title text-fg">{isRegister ? "Create your account" : "Sign in"}</h1>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {isRegister && <input className={inputCls} placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
          <input className={inputCls} type="email" placeholder="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            className={inputCls}
            type="password"
            placeholder="Password (min 8 characters)"
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{error}</p>}
          <button type="submit" disabled={busy} className="btn-brand">
            {busy ? "Please wait…" : isRegister ? "Sign up" : "Sign in"}
          </button>
        </form>
        <button onClick={() => { setIsRegister(!isRegister); setError(""); }} className="mt-5 w-full text-center text-body font-semibold text-brand-600 hover:text-brand-700">
          {isRegister ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
