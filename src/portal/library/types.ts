// ============================================================================
// AGENT.DOCS.1 — Library types
// ============================================================================
// Mirrors of the Vault agent-scoped template list. Only the shape the
// UI renders — no raw source_path, checksum, or tenant_id. Vault
// already scrubs those; we mirror the safe shape so a future contract
// change on either side surfaces as a TypeScript error.
// ============================================================================

/** Single blank-template card returned by
 *  GET /api/paperwork/agents/templates on Vault. */
export interface TemplateCard {
  form_id: string;
  form_name: string;
  category: string;
  revision: string | null;
  bytes: number | null;
  active: boolean;
  /** True when the template is only downloadable because it's in the
   *  MANUAL_ONLY_FORM_IDS override (currently just LFD-1). Used to badge
   *  the row so agents understand why an "inactive" template is here. */
  manual_only: boolean;
}

export type LibraryResult =
  | { kind: "ok"; templates: TemplateCard[] }
  | { kind: "error"; status: number; message: string };
