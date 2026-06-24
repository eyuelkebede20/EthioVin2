"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

// Session-aware right side of the header. Client island — safe to drop into a
// server-rendered header.
export default function AuthNav() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  if (isPending) return <span className="text-caption text-fg-muted">…</span>;
  if (!session) {
    return (
      <Link href="/login" className="btn-brand !px-4 !py-2">
        Sign in
      </Link>
    );
  }

  const role = (session.user as { role?: string }).role ?? "user";
  return (
    <div className="flex items-center gap-3">
      <Link href="/account" className="hidden text-body text-fg-muted transition-colors hover:text-fg sm:inline">
        {session.user.name || session.user.email}
      </Link>
      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-caption font-bold uppercase tracking-wide text-brand-700">{role}</span>
      <button onClick={() => void signOut().then(() => router.push("/"))} className="btn-ghost !px-3 !py-1.5 text-caption">
        Sign out
      </button>
    </div>
  );
}
