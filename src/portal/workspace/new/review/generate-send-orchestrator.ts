// ============================================================================
// TRANSACTION OS 3.3D — Generate & Send orchestrator
// ============================================================================
// Composes the thin portal forwards (forms/add → generate → send) + the e-sign
// connection check. It ONLY orchestrates — no PDF, no envelope, no DocuSign
// logic (all in Vault). `fetchImpl` is injectable for offline unit tests.
//
// Idempotency:
//   • materialize (forms/add) is idempotent server-side → no duplicate instances
//   • generate re-runs overwrite → safe to retry
//   • send is guarded server-side against duplicate envelopes; the client also
//     skips forms already sent/signed
// ============================================================================

export interface OrchestratorDeps {
  fetchImpl?: typeof fetch;
}

/** A form the agent chose for the package. */
export interface SelectedForm {
  form_id: string;
  /** existing instance (required forms + already-materialized optionals). */
  form_instance_id?: string;
  generatable?: boolean;
  /** live disposition — used to skip already-sent forms. */
  disposition?: string;
}

export interface FormOutcome {
  form_id: string;
  form_instance_id?: string;
  ok: boolean;
  error?: string;
  unbound_fields?: string[];
  skipped?: boolean;
}

const SENT_DISPOSITIONS = new Set(["sent_for_signature", "signed", "completed_manual"]);

async function call(
  doFetch: typeof fetch,
  method: "GET" | "POST",
  url: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await doFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

/** True when the agent's DocuSign account is connected. */
export async function checkEsignConnected(deps: OrchestratorDeps = {}): Promise<boolean> {
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const r = await call(doFetch, "GET", "/api/esign/status");
    return !!r.data?.connected;
  } catch {
    return false;
  }
}

/** The DocuSign OAuth redirect URL (for the Connect CTA), or null. */
export async function getConnectUrl(deps: OrchestratorDeps = {}): Promise<string | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const r = await call(doFetch, "GET", "/api/esign/connect");
    return r.data?.redirectUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Materialize (if needed) + generate each selected form. Returns a per-form
 * outcome with the resolved form_instance_id so Send can reuse it.
 */
export async function generatePackage(
  transactionId: string,
  forms: SelectedForm[],
  deps: OrchestratorDeps = {}
): Promise<FormOutcome[]> {
  const doFetch = deps.fetchImpl ?? fetch;
  const outcomes: FormOutcome[] = [];

  for (const f of forms) {
    let fiid = f.form_instance_id;

    // 1. Materialize optional/rider forms lacking an instance (idempotent).
    if (!fiid) {
      let add;
      try {
        add = await call(doFetch, "POST", `/api/transactions/${transactionId}/forms/add`, {
          form_id: f.form_id,
        });
      } catch {
        outcomes.push({ form_id: f.form_id, ok: false, error: "Network error adding the form." });
        continue;
      }
      fiid = add.data?.form_instance_id;
      if (!add.ok || !fiid) {
        outcomes.push({ form_id: f.form_id, ok: false, error: add.data?.error || "Failed to add the form." });
        continue;
      }
    }

    // 2. Generate the PDF (re-run overwrites; safe to retry).
    let gen;
    try {
      gen = await call(doFetch, "POST", `/api/transactions/${transactionId}/documents/${fiid}/generate`, {});
    } catch {
      outcomes.push({ form_id: f.form_id, form_instance_id: fiid, ok: false, error: "Network error generating the PDF." });
      continue;
    }
    if (!gen.ok || gen.data?.ok === false) {
      outcomes.push({
        form_id: f.form_id,
        form_instance_id: fiid,
        ok: false,
        error: gen.data?.error || gen.data?.step || "Generation failed.",
        unbound_fields: gen.data?.unbound_fields,
      });
      continue;
    }
    outcomes.push({ form_id: f.form_id, form_instance_id: fiid, ok: true });
  }

  return outcomes;
}

export interface SendResult {
  results: FormOutcome[];
  /** true when Vault reported the DocuSign account isn't connected. */
  needsConnect: boolean;
}

/**
 * Send each selected form for signature. Skips already-sent forms. Stops and
 * flags needsConnect on the first esign_not_connected.
 */
export async function sendPackage(
  transactionId: string,
  forms: SelectedForm[],
  deps: OrchestratorDeps = {}
): Promise<SendResult> {
  const doFetch = deps.fetchImpl ?? fetch;
  const results: FormOutcome[] = [];

  for (const f of forms) {
    if (f.disposition && SENT_DISPOSITIONS.has(f.disposition)) {
      results.push({ form_id: f.form_id, form_instance_id: f.form_instance_id, ok: true, skipped: true });
      continue;
    }
    if (!f.form_instance_id) {
      results.push({ form_id: f.form_id, ok: false, error: "Generate the form before sending." });
      continue;
    }

    let res;
    try {
      res = await call(doFetch, "POST", `/api/transactions/${transactionId}/documents/${f.form_instance_id}/send`, {});
    } catch {
      results.push({ form_id: f.form_id, form_instance_id: f.form_instance_id, ok: false, error: "Network error sending." });
      continue;
    }

    if (
      res.status === 409 &&
      (res.data?.code === "esign_not_connected" || res.data?.code === "esign_incomplete")
    ) {
      results.push({ form_id: f.form_id, form_instance_id: f.form_instance_id, ok: false, error: "DocuSign not connected." });
      return { results, needsConnect: true };
    }
    if (!res.ok || res.data?.ok === false) {
      results.push({ form_id: f.form_id, form_instance_id: f.form_instance_id, ok: false, error: res.data?.error || "Send failed." });
      continue;
    }
    results.push({ form_id: f.form_id, form_instance_id: f.form_instance_id, ok: true });
  }

  return { results, needsConnect: false };
}

/** Open a preview: fetch a signed URL for a generated form and return it. */
export async function getPreviewUrl(
  transactionId: string,
  formInstanceId: string,
  deps: OrchestratorDeps = {}
): Promise<string | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const r = await call(
      doFetch,
      "GET",
      `/api/transactions/${transactionId}/documents/${formInstanceId}/download`
    );
    return r.data?.signed_url ?? null;
  } catch {
    return null;
  }
}
