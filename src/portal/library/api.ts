// ============================================================================
// AGENT.DOCS.1 — Server-only Vault agent-templates fetcher
// ============================================================================
// GET /api/paperwork/agents/templates on Vault. Bearer auth. Vault
// enforces tenant + role scoping + broker-only denylist +
// MANUAL_ONLY override + response scrubbing.
// ============================================================================

import "server-only";

import type { LibraryResult, TemplateCard } from "./types";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ??
  "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

export async function fetchAgentTemplates(input: {
  accessToken: string;
}): Promise<LibraryResult> {
  try {
    const res = await fetch(`${VAULT_API_URL}/paperwork/agents/templates`, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const message = await res.text().catch(() => res.statusText);
      return { kind: "error", status: res.status, message };
    }
    const body = await res.json();
    const templates: TemplateCard[] = Array.isArray(body?.templates)
      ? body.templates
      : [];
    return { kind: "ok", templates };
  } catch (err) {
    return {
      kind: "error",
      status: 500,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}
