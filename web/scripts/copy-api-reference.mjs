// Build step: copy the repo-root API_REFERENCE.md (the single source of truth for
// the /v1 contract) into web/ as a bundled TS string, so /developers/docs renders it
// without a manual copy or a markdown dependency. Runs on predev + prebuild.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "..", "API_REFERENCE.md");
const outDir = resolve(here, "..", "lib");
const out = resolve(outDir, "apiReference.ts");

const md = readFileSync(src, "utf8");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  out,
  `// AUTO-GENERATED from repo-root API_REFERENCE.md by scripts/copy-api-reference.mjs.\n// Do NOT edit — change API_REFERENCE.md and re-run \`npm run dev\`/\`build\`.\nexport const API_REFERENCE_MD = ${JSON.stringify(md)};\n`,
);
console.log(`[copy-api-reference] wrote ${out} (${md.length} chars)`);
