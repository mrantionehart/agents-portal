// ============================================================================
// TRANSACTION ASSISTANT 4.0D — client fetch
// ============================================================================
// Thin transport over the Vault 4.0C grounded endpoint:
//   POST /api/platform/transactions/[id]/assistant  { message, history, mode }
//
// Reuses the CoordinatorPanel idiom: injectable fetchImpl + getToken (lock-free
// getAccessToken by default) so tests never touch the network or the Supabase
// client. Bounds the call with an AbortController so the UI never hangs, and
// NEVER surfaces a raw status/provider error — every failure is mapped to a
// friendly AssistantError.
// ============================================================================

import type {
  AssistantEnvelope,
  AssistantMode,
  AssistantResult,
  DraftType,
} from "./assistant-types";
import { mapAssistantError } from "./assistant-view";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

/** UI-side ceiling — sits just above the server's 30s model timeout so a stuck
 *  request still resolves to a friendly "took too long" instead of spinning. */
export const ASSISTANT_CLIENT_TIMEOUT_MS = 35_000;

/** Lazy, lock-free token getter — mirrors CoordinatorPanel.defaultGetToken so
 *  tests (which inject getToken) never load the Supabase client, and the app
 *  never hits the navigator LockManager hang. */
async function defaultGetToken(): Promise<string | null> {
  const { getAccessToken } = await import("@/lib/supabase");
  return (await getAccessToken()) ?? null;
}

export interface AskAssistantInput {
  transactionId: string;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  mode?: AssistantMode;
  /** 4.0E.2 — explicit draft type from the picker. Vault forces mode=draft and
   *  applies the registered guidance + HartFelt voice. */
  draftType?: DraftType | null;
  /** Injected in tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected in tests. Defaults to the lock-free access-token helper. */
  getToken?: () => Promise<string | null>;
  /** Injected in tests. Overall request timeout in ms. */
  timeoutMs?: number;
}

export async function askAssistant(input: AskAssistantInput): Promise<AssistantResult> {
  const {
    transactionId,
    message,
    history,
    mode = "auto",
    draftType = null,
    fetchImpl,
    getToken,
    timeoutMs = ASSISTANT_CLIENT_TIMEOUT_MS,
  } = input;

  if (!transactionId) {
    return { ok: false, error: mapAssistantError(0, "no_transaction") };
  }

  const doFetch = fetchImpl ?? fetch;
  const readToken = getToken ?? defaultGetToken;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const token = await readToken();
    const res = await doFetch(
      `${VAULT_API_URL}/platform/transactions/${transactionId}/assistant`,
      {
        method: "POST",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(draftType ? { message, history, mode, draft_type: draftType } : { message, history, mode }),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      // Parse the structured error code when present; never surface raw text.
      let code: string | undefined;
      try {
        const body = (await res.json()) as { error?: { code?: string } };
        code = body?.error?.code;
      } catch {
        /* ignore — mapping falls back to the status */
      }
      return { ok: false, error: mapAssistantError(res.status, code) };
    }

    const envelope = (await res.json()) as AssistantEnvelope;
    return { ok: true, envelope };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, error: mapAssistantError(0, aborted ? "timeout" : "network") };
  } finally {
    clearTimeout(timer);
  }
}
