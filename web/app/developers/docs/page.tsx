import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import Markdown from "@/components/Markdown";
import { API_REFERENCE_MD } from "@/lib/apiReference";

export const metadata = {
  title: "API Reference — EthioVin",
  description: "The EthioVin /v1 VIN decode API contract.",
};

// Rendered from the repo-root API_REFERENCE.md (the single source of truth), copied
// into web/ at build time by scripts/copy-api-reference.mjs. Never fork the contract
// into JSX — edit API_REFERENCE.md.
export default function DocsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/developers" className="mb-6 inline-flex items-center gap-1.5 text-caption font-semibold text-brand-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to developers
        </Link>
        <article>
          <Markdown source={API_REFERENCE_MD} />
        </article>
      </main>
    </>
  );
}
