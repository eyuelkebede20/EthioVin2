import React, { type ReactNode } from "react";

// A small, dependency-free Markdown renderer for API_REFERENCE.md. Covers exactly the
// subset that file uses: headings, fenced code, tables, unordered lists, blockquotes,
// horizontal rules, paragraphs, and inline bold / code / links. Not a general parser.

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Inline: `code`, **bold**, [text](url). Processed in that precedence.
function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("`")) {
      nodes.push(<code key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-700">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={k} className="font-bold text-fg">{tok.slice(2, -2)}</strong>);
    } else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      nodes.push(<a key={k} href={mm[2]} className="text-brand-600 underline">{mm[1]}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const nextKey = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre key={nextKey()} className="my-4 overflow-x-auto rounded-lg bg-fg p-4 font-mono text-caption leading-relaxed text-white/90">
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={nextKey()} className="my-8 border-border" />);
      i++;
      continue;
    }

    // Heading
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const id = slug(text);
      const cls =
        level === 1 ? "mt-2 text-display font-bold text-fg" : level === 2 ? "mt-10 text-title font-bold text-fg" : level === 3 ? "mt-6 text-lead font-bold text-fg" : "mt-4 text-body font-bold text-fg";
      const content = inline(text, id);
      blocks.push(
        level === 1 ? (
          <h1 key={nextKey()} id={id} className={cls}>{content}</h1>
        ) : level === 2 ? (
          <h2 key={nextKey()} id={id} className={cls}>{content}</h2>
        ) : level === 3 ? (
          <h3 key={nextKey()} id={id} className={cls}>{content}</h3>
        ) : (
          <h4 key={nextKey()} id={id} className={cls}>{content}</h4>
        ),
      );
      i++;
      continue;
    }

    // Table
    if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      const cells = (r: string) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const header = cells(rows[0]);
      const bodyRows = rows.slice(2); // skip the |---| separator
      blocks.push(
        <div key={nextKey()} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr>
                {header.map((c, ci) => (
                  <th key={ci} className="border border-border bg-surface-2 px-3 py-2 text-left font-bold text-fg">{inline(c, `th${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((r, ri) => (
                <tr key={ri}>
                  {cells(r).map((c, ci) => (
                    <td key={ci} className="border border-border px-3 py-2 align-top text-fg-muted">{inline(c, `td${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (line.trim().startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={nextKey()} className="my-4 border-l-4 border-brand-300 bg-brand-50 px-4 py-2 text-body text-fg-muted">
          {inline(body.join(" "), "bq")}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && (/^\s*-\s+/.test(lines[i]) || (items.length > 0 && /^\s{2,}\S/.test(lines[i])))) {
        if (/^\s*-\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*-\s+/, ""));
        else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      blocks.push(
        <ul key={nextKey()} className="my-4 list-disc space-y-1 pl-6 text-body text-fg-muted">
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `li${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph (group consecutive plain lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("#") &&
      !/^---+$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith(">") &&
      !/^\s*-\s+/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push(
      <p key={nextKey()} className="my-3 text-body leading-relaxed text-fg-muted">{inline(para.join(" "), "p")}</p>,
    );
  }

  return <div className="max-w-none">{blocks}</div>;
}
