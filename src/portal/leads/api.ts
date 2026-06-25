// ============================================================================
// AGENT PORTAL 2.1 — R3B — Server-only leads + intakes fetchers
// ============================================================================
// Two read-only fetches against same-origin agents-portal proxies. Both
// proxies enforce SEC.3A tenant scope on the server side; this file
// just forwards the caller's cookies + maps response shapes.
// ============================================================================

import "server-only";

import type { IntakeRow, LeadRow } from "./types";

interface FetchInput {
  baseUrl: string;
  cookieHeader: string;
}

/** Fetch agents-portal /api/new-leads?filter=all. The endpoint is
 *  SEC.3A-scoped; we layer caller-relative bucket derivation on top in
 *  the helper. */
export async function fetchLeads(input: FetchInput): Promise<{
  kind: "ok" | "error";
  leads?: LeadRow[];
  message?: string;
}> {
  try {
    const res = await fetch(`${input.baseUrl}/api/new-leads?filter=all`, {
      headers: {
        cookie: input.cookieHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        kind: "error",
        message: `HTTP ${res.status}`,
      };
    }
    const body = await res.json();
    const leads = Array.isArray(body?.leads) ? (body.leads as LeadRow[]) : [];
    return { kind: "ok", leads };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Fetch agents-portal /api/broker/intakes. Also SEC.3A-scoped. */
export async function fetchIntakes(input: FetchInput): Promise<{
  kind: "ok" | "error";
  intakes?: IntakeRow[];
  message?: string;
}> {
  try {
    const res = await fetch(`${input.baseUrl}/api/broker/intakes`, {
      headers: {
        cookie: input.cookieHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        kind: "error",
        message: `HTTP ${res.status}`,
      };
    }
    const body = await res.json();
    const intakes = Array.isArray(body?.intakes)
      ? (body.intakes as IntakeRow[])
      : [];
    return { kind: "ok", intakes };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}
