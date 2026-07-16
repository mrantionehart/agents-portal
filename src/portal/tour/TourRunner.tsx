// ============================================================================
// AP2 guided-training — TourRunner
// ============================================================================
// Renders the overlay + spotlight + tooltip when a tour is active. Mounts
// as a sibling of the app; consumes state from useTour().
//
// Accessibility:
//   * The tooltip is a role="dialog" with aria-labelledby + aria-describedby.
//   * Focus is trapped within the tooltip while it is open.
//   * Escape triggers Exit (via an exit-confirm affordance rendered inline
//     with the Exit button — no silent dismissal).
//   * Missing-target fallback provides a clear "Exit tour" affordance so
//     the user is never stranded.
//   * prefers-reduced-motion disables the spotlight animation.
//   * Because the overlay uses pointer-events: none for most of the
//     screen (spotlight is transparent), logout and emergency navigation
//     remain reachable.
// ============================================================================

"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { resolveAnchor } from "./anchors";
import { useTour } from "./TourProvider";
import type { TooltipPlacement, TourContentNode, TourStep } from "./types";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function TourRunner() {
  const tour = useTour();

  if (!tour.script || !tour.currentStep) return null;

  return (
    <div
      data-tour-runner
      className="fixed inset-0 z-[70] pointer-events-none"
      aria-live="polite"
    >
      {tour.mode === "preview" && <PreviewBanner />}
      {tour.completed ? <CompletionCard /> : <TourStepView />}
    </div>
  );
}

function CompletionCard() {
  const tour = useTour();
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      data-tour-completion
      className="pointer-events-auto absolute bg-[#0f1218] border border-emerald-500/40 text-[#F1F1F3] rounded-lg shadow-xl p-5 w-[400px] max-w-[92vw]"
      style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
    >
      <h2 className="text-[15px] font-semibold text-emerald-200 mb-2">
        {tour.mode === "preview"
          ? "Preview complete. No progress was saved."
          : "Lesson complete."}
      </h2>
      <p className="text-[13px] text-[#D4D4D8]">
        {tour.mode === "preview"
          ? "Nothing was written for your certification. Close this to return to the training hub."
          : "Your progress has been recorded."}
      </p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={tour.exit}
          className="text-[12px] px-3 py-1 rounded bg-[#C9A84C] text-black font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Preview banner (persistent, dismisses only with Exit) ───────────────────

function PreviewBanner() {
  return (
    <div
      role="status"
      className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 bg-[#C9A84C] text-black text-xs font-semibold tracking-wide uppercase rounded px-3 py-1 shadow"
    >
      Preview — progress will not be saved
    </div>
  );
}

// ─── Main step view ──────────────────────────────────────────────────────────

function TourStepView() {
  const tour = useTour();
  const step = tour.currentStep!;
  const script = tour.script!;

  const isFinalStep = tour.currentIndex === script.steps.length - 1;

  const resolution = useAnchorResolution(step);
  const anchorRect = resolution.kind === "resolved" ? resolution.rect : null;
  // "Missing" now means the bounded resolver has actually GIVEN UP after
  // the timeout. During pending we render the tooltip in center-placement
  // fallback rather than the alarming MissingTargetCard.
  const anchorMissing = step.targetId !== null && resolution.kind === "missing";

  // Report missing target once per (step, targetId), and only after the
  // bounded resolution wait has confirmed it. Pending doesn't warn.
  useEffect(() => {
    if (!anchorMissing || !step.targetId) return;
    tour.registerMissingTarget({
      step_id: step.id,
      target_id: step.targetId,
      route: typeof window !== "undefined" ? window.location.pathname : "",
      timestamp: new Date().toISOString(),
    });
  }, [anchorMissing, step.id, step.targetId]);

  // Scroll target into view if resolved.
  useEffect(() => {
    if (!step.targetId) return;
    const el = resolveAnchor(step.targetId);
    if (el && "scrollIntoView" in el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } catch {
        el.scrollIntoView();
      }
    }
  }, [step.id, step.targetId]);

  return (
    <>
      <Spotlight rect={anchorRect} placement={step.placement} />
      {anchorMissing ? (
        <MissingTargetCard step={step} />
      ) : (
        <Tooltip step={step} anchorRect={anchorRect} isFinalStep={isFinalStep} />
      )}
    </>
  );
}

// ─── Spotlight overlay ───────────────────────────────────────────────────────

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function Spotlight({
  rect,
  placement,
}: {
  rect: Rect | null;
  placement: TooltipPlacement;
}) {
  const [reduced] = useReducedMotion();

  if (!rect || placement === "center") {
    return (
      <div
        data-tour-overlay
        aria-hidden
        className="absolute inset-0 bg-black/60 pointer-events-none"
      />
    );
  }

  const pad = 8;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  return (
    <svg
      data-tour-overlay
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transition: reduced ? "none" : "all 180ms ease-out" }}
    >
      <defs>
        <mask id="tour-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={6} ry={6} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.6)"
        mask="url(#tour-spotlight-mask)"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        ry={6}
        fill="none"
        stroke="#C9A84C"
        strokeWidth={2}
      />
    </svg>
  );
}

// ─── Tooltip card ────────────────────────────────────────────────────────────

function Tooltip({
  step,
  anchorRect,
  isFinalStep,
}: {
  step: TourStep;
  anchorRect: Rect | null;
  isFinalStep: boolean;
}) {
  const tour = useTour();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [confirmingExit, setConfirmingExit] = useState(false);

  useFocusTrap(cardRef);
  useEscExit(cardRef, () => setConfirmingExit(true));

  const style = useTooltipPosition(anchorRect, step.placement);

  const canFinish =
    isFinalStep &&
    (step.interaction.kind === "informational" ||
      step.interaction.kind === "manual_confirmation");
  const showFinishButton = canFinish;
  const showNextButton =
    !isFinalStep &&
    (step.interaction.kind === "informational" ||
      step.interaction.kind === "manual_confirmation");

  const showAwaitingLabel =
    step.interaction.kind === "target_click" ||
    step.interaction.kind === "route_change";

  const titleId = `tour-title-${step.id}`;
  const descId = `tour-desc-${step.id}`;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-tour-tooltip
      className="pointer-events-auto absolute bg-[#0f1218] border border-[#2b2f3a] text-[#F1F1F3] rounded-lg shadow-xl p-4 w-[360px] max-w-[92vw] text-sm"
      style={style}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 id={titleId} className="text-[15px] font-semibold leading-tight">
          {step.title}
        </h2>
        <span
          aria-label={`Step ${step.order} of ${tour.script?.steps.length ?? step.order}`}
          className="text-[11px] text-[#A1A1AA] whitespace-nowrap"
        >
          {step.order}/{tour.script?.steps.length ?? step.order}
        </span>
      </div>

      <div id={descId} className="space-y-2 text-[13px] text-[#D4D4D8]">
        {step.bodyContent.map((node, i) => (
          <ContentNodeView key={i} node={node} />
        ))}
      </div>

      {showAwaitingLabel && (
        <p className="mt-3 text-[11px] uppercase tracking-wide text-[#71717A]">
          {step.interaction.kind === "target_click"
            ? "Click the highlighted element to continue."
            : "Waiting for you to reach the next surface."}
        </p>
      )}

      {tour.error && (
        <p role="alert" className="mt-3 text-[12px] text-red-300">
          {tour.error}
        </p>
      )}

      {confirmingExit ? (
        <ExitConfirm
          onKeep={() => setConfirmingExit(false)}
          onExit={tour.exit}
        />
      ) : (
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setConfirmingExit(true)}
            className="text-[12px] text-[#A1A1AA] hover:text-[#F1F1F3] underline underline-offset-2"
          >
            Exit tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={tour.back}
              disabled={tour.currentIndex === 0}
              className="text-[12px] px-2 py-1 rounded border border-[#2b2f3a] text-[#D4D4D8] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back
            </button>
            {showNextButton && (
              <button
                type="button"
                onClick={tour.next}
                className="text-[12px] px-3 py-1 rounded bg-[#C9A84C] text-black font-semibold hover:brightness-95"
              >
                Next
              </button>
            )}
            {showFinishButton && (
              <button
                type="button"
                onClick={tour.finish}
                disabled={tour.submitting}
                className="text-[12px] px-3 py-1 rounded bg-[#C9A84C] text-black font-semibold hover:brightness-95 disabled:opacity-50"
              >
                {tour.submitting ? "Saving…" : tour.mode === "preview" ? "Finish (preview)" : "Finish"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExitConfirm({
  onKeep,
  onExit,
}: {
  onKeep: () => void;
  onExit: () => void;
}) {
  return (
    <div className="mt-4 border-t border-[#2b2f3a] pt-3">
      <p className="text-[12px] text-[#D4D4D8]">
        Exit this tour? Your place is saved — you can resume later.
      </p>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="text-[12px] px-2 py-1 rounded border border-[#2b2f3a] text-[#D4D4D8]"
        >
          Keep going
        </button>
        <button
          type="button"
          onClick={onExit}
          className="text-[12px] px-3 py-1 rounded bg-red-500/80 text-white"
        >
          Yes, exit
        </button>
      </div>
    </div>
  );
}

// ─── Missing target fallback ─────────────────────────────────────────────────

function MissingTargetCard({ step }: { step: TourStep }) {
  const tour = useTour();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const headingId = `tour-missing-target-title-${step.id}`;
  const descId = `tour-missing-target-desc-${step.id}`;
  const style = useTooltipPosition(null, "center");

  useFocusTrap(cardRef);

  // Escape → same exit path as the main tour card (opens the tour's
  // exit method). Consistent with the primary flow — never silently
  // dismisses.
  useEscExit(cardRef, tour.exit);

  return (
    <div
      ref={cardRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descId}
      data-tour-missing-target
      className="pointer-events-auto absolute bg-[#1a1210] border border-red-500/40 text-[#F1F1F3] rounded-lg shadow-xl p-4 w-[400px] max-w-[92vw] text-sm"
      style={style}
    >
      <h2 id={headingId} className="text-[15px] font-semibold text-red-200 mb-2">
        Element not found on this screen
      </h2>
      <p id={descId} className="text-[13px] text-[#D4D4D8]">
        The tour expected to highlight <code className="text-[#C9A84C]">{step.targetId}</code>{" "}
        for step <strong>{step.title}</strong>, but no matching element is on
        this page. You can safely exit or retry.
      </p>
      {tour.mode === "preview" && (
        <p className="mt-2 text-[12px] text-[#A1A1AA]">
          Preview diagnostic reported to console: step_id={step.id}, target_id=
          {step.targetId}.
        </p>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={tour.exit}
          className="text-[12px] px-3 py-1 rounded border border-[#2b2f3a] text-[#D4D4D8]"
        >
          Exit tour
        </button>
        <button
          type="button"
          onClick={tour.retry}
          className="text-[12px] px-3 py-1 rounded bg-[#C9A84C] text-black font-semibold"
        >
          Retry from step 1
        </button>
      </div>
    </div>
  );
}

// ─── Content node rendering (deterministic, no HTML input) ───────────────────

function ContentNodeView({ node }: { node: TourContentNode }) {
  switch (node.type) {
    case "heading":
      return node.level === 2 ? (
        <h3 className="text-[14px] font-semibold text-[#F1F1F3]">{node.text}</h3>
      ) : (
        <h4 className="text-[13px] font-semibold text-[#F1F1F3]">{node.text}</h4>
      );
    case "paragraph":
      return <p className="text-[13px] text-[#D4D4D8]">{node.text}</p>;
    case "list":
      return node.ordered ? (
        <ol className="list-decimal list-inside space-y-0.5 text-[#D4D4D8]">
          {node.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc list-inside space-y-0.5 text-[#D4D4D8]">
          {node.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
  }
}

// ─── Positioning + a11y helpers ──────────────────────────────────────────────

/**
 * Bounded window during which useAnchorRect will keep polling for a
 * delayed-mount destination anchor before giving up and reporting
 * missing. Chosen to comfortably cover most Next.js server-component
 * paint + hydrate latency without becoming a stall for genuinely
 * missing targets.
 */
export const ANCHOR_RESOLUTION_TIMEOUT_MS = 750 as const;

/**
 * Discriminated resolution state so callers (and tests) can distinguish
 * "anchor confirmed missing after bounded wait" from "still resolving".
 */
export type AnchorResolution =
  | { kind: "resolved"; rect: Rect }
  | { kind: "pending" }
  | { kind: "missing" };

function useAnchorResolution(step: TourStep): AnchorResolution {
  const [resolution, setResolution] = useState<AnchorResolution>(
    step.targetId === null
      ? ({ kind: "missing" } as AnchorResolution) // treated as no-spotlight, not fallback
      : { kind: "pending" },
  );

  useLayoutEffect(() => {
    // Null targetId means "no spotlight" (center placement). Not a
    // missing target — the tooltip renders in the center card.
    if (!step.targetId) {
      setResolution({ kind: "missing" });
      return;
    }

    setResolution({ kind: "pending" });

    let cancelled = false;
    let rafId = 0;
    const started = performance.now();

    const compute = (): boolean => {
      if (cancelled) return true;
      const el = resolveAnchor(step.targetId!);
      if (el) {
        const r = el.getBoundingClientRect();
        setResolution({
          kind: "resolved",
          rect: { top: r.top, left: r.left, width: r.width, height: r.height },
        });
        return true;
      }
      return false;
    };

    // Try synchronously first — the common case.
    if (compute()) {
      // Fall through to attach resize/scroll listeners below.
    } else {
      // Bounded rAF poll for delayed mounts (typical Next.js server
      // component paint). Stops on: found, step change, unmount,
      // timeout.
      const tick = () => {
        if (cancelled) return;
        if (compute()) return;
        if (performance.now() - started >= ANCHOR_RESOLUTION_TIMEOUT_MS) {
          if (!cancelled) setResolution({ kind: "missing" });
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    const onWindow = () => {
      compute();
    };
    window.addEventListener("resize", onWindow);
    window.addEventListener("scroll", onWindow, true);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onWindow);
      window.removeEventListener("scroll", onWindow, true);
    };
  }, [step.id, step.targetId]);

  return resolution;
}

// Back-compat wrapper — most existing callsites expect the rect-or-null.
// Callers that need the pending state can use useAnchorResolution.
function useAnchorRect(step: TourStep): Rect | null {
  const r = useAnchorResolution(step);
  return r.kind === "resolved" ? r.rect : null;
}

function useTooltipPosition(
  anchor: Rect | null,
  placement: TooltipPlacement,
): React.CSSProperties {
  return useMemo(() => {
    // Simple absolute positioning. `center` and missing anchor use the
    // center of the viewport. Directional placements offset from the
    // anchor bounding box.
    if (!anchor || placement === "center") {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const OFFSET = 12;
    const width = 360;
    const height = 220; // approximate; overflow is fine
    let left = anchor.left + anchor.width / 2 - width / 2;
    let top = anchor.top + anchor.height + OFFSET;
    switch (placement) {
      case "top":
        top = anchor.top - height - OFFSET;
        break;
      case "bottom":
        top = anchor.top + anchor.height + OFFSET;
        break;
      case "left":
        left = anchor.left - width - OFFSET;
        top = anchor.top + anchor.height / 2 - height / 2;
        break;
      case "right":
        left = anchor.left + anchor.width + OFFSET;
        top = anchor.top + anchor.height / 2 - height / 2;
        break;
    }
    return {
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
    };
  }, [anchor, placement]);
}

function useFocusTrap(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Restore focus to the trigger when the tooltip unmounts.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable element in the card on mount.
    requestAnimationFrame(() => {
      const first = getFocusable(el)[0];
      first?.focus();
    });

    const handler = (ev: KeyboardEvent) => {
      if (ev.key !== "Tab") return;
      const focusables = getFocusable(el);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (ev.shiftKey && active === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && active === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previouslyFocused?.focus?.();
    };
  }, [ref]);
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled"));
}

function useEscExit(
  ref: React.RefObject<HTMLElement | null>,
  onEsc: () => void,
) {
  const handler = useCallback(
    (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onEsc();
      }
    },
    [onEsc],
  );
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler, ref]);
}

function useReducedMotion(): [boolean] {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(m.matches);
    const handler = () => setReduced(m.matches);
    m.addEventListener?.("change", handler);
    return () => m.removeEventListener?.("change", handler);
  }, []);
  return [reduced];
}
