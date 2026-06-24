"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import AuthNav from "./AuthNav";

export interface NavItem {
  href: string;
  label: string;
}

// Authed layout with a sidebar. Session-gated: redirects to /login if signed out.
// Generic so garage / insurer / admin dashboards reuse it with their own nav.
export default function AppShell({ title, nav, requireRole, children }: { title: string; nav: NavItem[]; requireRole?: string; children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isPending && !session) router.push(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isPending, session, router, pathname]);

  if (isPending || !session) return <main className="p-16 text-center text-body text-fg-muted">Loading…</main>;

  const role = (session.user as { role?: string }).role;
  const roleOk = !requireRole || role === requireRole;

  const isActive = (href: string) => pathname === href || (href === "/garage" ? pathname.startsWith("/garage/jobs") : pathname.startsWith(`${href}/`));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-black text-white shadow-brand">V</span>
            <span className="text-lead font-extrabold tracking-tight text-fg">{title}</span>
          </Link>
          <AuthNav />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-[200px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <nav className="flex gap-2 overflow-x-auto md:flex-col">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-body font-semibold transition-colors ${isActive(n.href) ? "bg-brand-100 text-brand-700" : "text-fg-muted hover:bg-surface-2 hover:text-fg"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">
          {roleOk ? (
            children
          ) : (
            <div className="card p-10 text-center">
              <h2 className="text-title text-fg">Restricted</h2>
              <p className="mx-auto mt-2 max-w-md text-body text-fg-muted">This area requires the {requireRole} role.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
