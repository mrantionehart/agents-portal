// ============================================================================
// PDI lesson content renderer — Vault ContentBlock → JSX
// ============================================================================
// Renders the structured blocks Vault serves from /lessons/{id}/content.
// Text is rendered as text (never as HTML); inline emphasis comes from spans.
// Unknown block kinds render nothing rather than raw data.
// ============================================================================

import type { ContentBlock, RichText, TableCell } from "./pdi-api";

export function Rich({ value }: { value: RichText }) {
  if (typeof value === "string") return <>{value}</>;
  return (
    <>
      {value.map((s, i) =>
        s.style === "bold" ? <strong key={i}>{s.text}</strong>
        : s.style === "italic" ? <em key={i}>{s.text}</em>
        : s.style === "code" ? <code key={i} className="rounded bg-white/10 px-1 text-[0.9em]">{s.text}</code>
        : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

function cellContent(c: TableCell): RichText {
  return typeof c === "string" || Array.isArray(c) ? (c as RichText) : (c as { content: RichText }).content;
}

const CALLOUT_TONE: Record<string, string> = {
  prohibition: "border-rose-700/50 bg-rose-900/20",
  scope: "border-[#C9A84C]/50 bg-[#C9A84C]/10",
  legal: "border-sky-700/50 bg-sky-900/20",
};

export function ContentBlocks({ blocks }: { blocks: readonly ContentBlock[] }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-[#E4E4E7]">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return <h3 key={i} className="pt-2 text-base font-semibold text-[#F1F1F3]"><Rich value={(b as { text: RichText }).text} /></h3>;
          case "paragraph":
            return <p key={i}><Rich value={(b as { text: RichText }).text} /></p>;
          case "list":
            return <ul key={i} className="list-disc pl-5 space-y-1">{(b as unknown as { items: RichText[] }).items.map((t, j) => <li key={j}><Rich value={t} /></li>)}</ul>;
          case "ordered":
            return <ol key={i} className="list-decimal pl-5 space-y-1">{(b as unknown as { items: RichText[] }).items.map((t, j) => <li key={j}><Rich value={t} /></li>)}</ol>;
          case "quote":
            return <blockquote key={i} className="border-l-2 border-[#C9A84C] pl-3 italic"><Rich value={(b as { text: RichText }).text} /></blockquote>;
          case "callout": {
            const c = b as { title: RichText; text: RichText; variant?: string };
            return (
              <aside key={i} role="note" className={`rounded-lg border px-3 py-2 ${CALLOUT_TONE[c.variant ?? ""] ?? "border-white/15 bg-white/5"}`}>
                <p className="font-semibold"><Rich value={c.title} /></p>
                <p><Rich value={c.text} /></p>
              </aside>
            );
          }
          case "comparison": {
            const c = b as { badLabel: string; bad: RichText; goodLabel: string; good: RichText };
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <div className="rounded border border-rose-700/40 p-2"><p className="font-semibold">{c.badLabel}</p><Rich value={c.bad} /></div>
                <div className="rounded border border-emerald-700/40 p-2"><p className="font-semibold">{c.goodLabel}</p><Rich value={c.good} /></div>
              </div>
            );
          }
          case "table": {
            const t = b as unknown as { caption?: string; headers?: RichText[]; rows: TableCell[][] };
            return (
              <div key={i} className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  {t.caption ? <caption className="text-left text-[#A1A1AA] pb-1">{t.caption}</caption> : null}
                  {t.headers ? (
                    <thead><tr>{t.headers.map((h, j) => <th key={j} className="border border-white/10 px-2 py-1 text-left"><Rich value={h} /></th>)}</tr></thead>
                  ) : null}
                  <tbody>
                    {t.rows.map((r, j) => (
                      <tr key={j}>{r.map((c, k) => <td key={k} className="border border-white/10 px-2 py-1 align-top"><Rich value={cellContent(c)} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
