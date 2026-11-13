// ============================================================================
// Reading lesson (requirement kind "acknowledgement")
// ============================================================================
// Fetches the lesson's prose from Vault's lesson-content route and renders its
// blocks, then lets the learner confirm they have read it:
//   POST /api/platform/certifications/{cert}/lessons/{id}/complete
//        { acknowledgement: true }
// Vault decides everything: whether the learner may read it at all (program
// active + assigned), prerequisites (409), and completion. This component
// stores nothing and never marks anything complete locally.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";

import { CertApiError, acknowledgeLesson, fetchLessonContent } from "../api";
import type { LessonContentBlock, LessonContentResponse, RichText } from "../types";

interface Props {
  certificationId: string;
  lessonId: string;
  alreadyCompleted: boolean;
  onCompleted: () => void;
}

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; content: LessonContentResponse };

export default function AcknowledgementLesson({ certificationId, lessonId, alreadyCompleted, onCompleted }: Props) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoad({ kind: "loading" });
    fetchLessonContent({ certificationId, lessonId })
      .then((content) => live && setLoad({ kind: "ready", content }))
      .catch((e) => live && setLoad({ kind: "error", message: errorText(e, "This lesson could not be loaded.") }));
    return () => {
      live = false;
    };
  }, [certificationId, lessonId]);

  const acknowledge = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await acknowledgeLesson({ certificationId, lessonId });
      onCompleted();
    } catch (e) {
      setSubmitError(errorText(e, "Could not record your completion. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }, [certificationId, lessonId, onCompleted]);

  if (load.kind === "loading")
    return <p className="text-sm text-[#71717A]" data-cert-lesson-content-loading>Loading lesson…</p>;
  if (load.kind === "error")
    return (
      <section className="rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300" data-cert-lesson-content-error>
        {load.message}
      </section>
    );

  const { content } = load;
  return (
    <section className="space-y-5" data-cert-activity="acknowledgement">
      {content.objective && (
        <p className="text-sm text-[#A1A1AA]" data-cert-lesson-objective>
          <span className="font-semibold text-[#F1F1F3]">Objective: </span>
          {content.objective}
        </p>
      )}
      <article className="space-y-4 rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-5" data-cert-lesson-content>
        {content.blocks.map((b, i) => (
          <Block key={(b as { id?: string }).id ?? i} block={b} />
        ))}
      </article>
      <div className="flex flex-wrap items-center gap-3">
        {alreadyCompleted ? (
          <div className="rounded border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300" data-cert-acknowledged>
            ✅ Lesson completed
          </div>
        ) : (
          <button
            type="button"
            onClick={acknowledge}
            disabled={submitting}
            className="inline-flex items-center rounded bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b8963f] disabled:opacity-60"
            data-cert-acknowledge
          >
            {submitting ? "Saving…" : "I have read this lesson — mark complete"}
          </button>
        )}
        {submitError && (
          <span className="text-xs text-rose-300" role="alert" data-cert-acknowledge-error>
            {submitError}
          </span>
        )}
      </div>
    </section>
  );
}

function errorText(e: unknown, fallback: string): string {
  if (e instanceof CertApiError) return e.status === 404 ? "This training is not available to you." : e.message || fallback;
  return fallback;
}

function Rich({ value }: { value: RichText }) {
  if (typeof value === "string") return <>{value}</>;
  return (
    <>
      {value.map((s, i) =>
        s.style === "bold" ? (
          <strong key={i}>{s.text}</strong>
        ) : s.style === "italic" ? (
          <em key={i}>{s.text}</em>
        ) : s.style === "code" ? (
          <code key={i}>{s.text}</code>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LessonContentBlock }) {
  const b = block as Record<string, unknown> & { kind: string };
  switch (b.kind) {
    case "heading":
      return <h3 className="text-base font-semibold text-[#F1F1F3]"><Rich value={b.text as RichText} /></h3>;
    case "paragraph":
      return <p className="text-sm leading-relaxed text-[#D4D4D8]"><Rich value={b.text as RichText} /></p>;
    case "quote":
      return <blockquote className="border-l-2 border-[#C9A84C] pl-3 text-sm italic text-[#D4D4D8]"><Rich value={b.text as RichText} /></blockquote>;
    case "list":
    case "ordered": {
      const items = (b.items as RichText[]) ?? [];
      const Tag = b.kind === "ordered" ? "ol" : "ul";
      return (
        <Tag className={`${b.kind === "ordered" ? "list-decimal" : "list-disc"} space-y-1 pl-5 text-sm text-[#D4D4D8]`}>
          {items.map((it, i) => (
            <li key={i}><Rich value={it} /></li>
          ))}
        </Tag>
      );
    }
    case "callout":
      return (
        <div className="rounded border border-[#C9A84C]/30 bg-[#C9A84C]/10 p-3" data-cert-callout={String(b.variant ?? "note")}>
          <p className="text-sm font-semibold text-[#F1F1F3]"><Rich value={b.title as RichText} /></p>
          <p className="mt-1 text-sm text-[#D4D4D8]"><Rich value={b.text as RichText} /></p>
        </div>
      );
    case "comparison":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            <p className="font-semibold">{String(b.badLabel)}</p>
            <p className="mt-1"><Rich value={b.bad as RichText} /></p>
          </div>
          <div className="rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
            <p className="font-semibold">{String(b.goodLabel)}</p>
            <p className="mt-1"><Rich value={b.good as RichText} /></p>
          </div>
        </div>
      );
    case "table": {
      const headers = (b.headers as RichText[] | undefined) ?? [];
      const rows = (b.rows as unknown[][]) ?? [];
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-[#D4D4D8]">
            {typeof b.caption === "string" && <caption className="mb-1 text-left text-[#A1A1AA]">{b.caption}</caption>}
            {headers.length > 0 && (
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="border border-[#252538] bg-[#11111a] px-2 py-1 text-left"><Rich value={h} /></th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => {
                    const cell = (typeof c === "string" || Array.isArray(c) ? { content: c } : c) as {
                      content: RichText;
                      colSpan?: number;
                      rowSpan?: number;
                    };
                    return (
                      <td key={ci} colSpan={cell.colSpan} rowSpan={cell.rowSpan} className="border border-[#252538] px-2 py-1 align-top">
                        <Rich value={cell.content} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      // Fail visible, never silently drop instructional content.
      return (
        <p className="text-xs text-amber-300" data-cert-unsupported-block={b.kind}>
          This part of the lesson ({b.kind}) can&apos;t be shown here yet.
        </p>
      );
  }
}
