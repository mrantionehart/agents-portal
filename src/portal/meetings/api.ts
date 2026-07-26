// ============================================================================
// AGENT PORTAL — Meetings — Vault API client (server-only, SSR reads)
// ============================================================================
// Calls the MERGED Vault agent-safe endpoints (PR #118) with the caller's
// Supabase access token forwarded as Bearer. Vault enforces role scope + the
// agent-safe projection at the SOURCE; the defensive pickers below are
// belt-and-suspenders for rendering, NOT the security boundary.
//
// server-only: importing this from a client component fails the build.
// ============================================================================
import "server-only";

import { VAULT_BASE_URL } from "@/src/portal/workspace/api";
import type { AgentMeetingListItem, AgentMeetingDetail } from "./types";
import { pickListItem, pickDetail } from "./projection";

export type MeetingsListResult =
  | { ok: true; items: AgentMeetingListItem[] }
  | { ok: false; status: number; message: string };

export type MeetingDetailResult =
  | { ok: true; detail: AgentMeetingDetail }
  | { ok: false; status: number; message: string };

async function errBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 200); } catch { return res.statusText; }
}

/** GET /meetings — the agent's own meetings (Vault self-scopes by role). */
export async function fetchAgentMeetings(accessToken: string): Promise<MeetingsListResult> {
  let res: Response;
  try {
    res = await fetch(`${VAULT_BASE_URL}/meetings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, message: await errBody(res) };
  const json = (await res.json().catch(() => null)) as { meetings?: unknown[] } | null;
  const rows = Array.isArray(json?.meetings) ? json!.meetings as Record<string, unknown>[] : [];
  return { ok: true, items: rows.map(pickListItem) };
}

/** GET /meetings/[id] — agent-safe detail. 404 for another agent / cross-tenant. */
export async function fetchAgentMeetingDetail(accessToken: string, id: string): Promise<MeetingDetailResult> {
  let res: Response;
  try {
    res = await fetch(`${VAULT_BASE_URL}/meetings/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, message: await errBody(res) };
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || typeof json !== "object") return { ok: false, status: 502, message: "bad response" };
  return { ok: true, detail: pickDetail(json) };
}
