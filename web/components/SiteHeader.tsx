import Link from "next/link";
import AuthNav from "./AuthNav";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-black text-white shadow-brand">V</span>
          <span className="text-lead font-extrabold tracking-tight text-fg">EthioVin</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-6">
          <Link href="/#how" className="hidden text-body text-fg-muted transition-colors hover:text-fg sm:inline">
            How it works
          </Link>
          <Link href="/#pricing" className="hidden text-body text-fg-muted transition-colors hover:text-fg sm:inline">
            Pricing
          </Link>
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
