// ============================================================================
// TRANSACTION OS 3.3C — Package Review Vault client (server-only)
// ============================================================================
// Thin wrapper that calls Vault's read-only GET
// /api/paperwork/agents/transactions/[id]/package with the user's access token
// forwarded as Bearer. ZERO new business logic — Vault assembles the plan.
// Server-only: a client import fails the build.
// ============================================================================

import "server-only";

import { VAULT_BASE_URL } from "../../api";
import type { PackageReviewData } from "./types";

export type FetchPackageResult =
  | { ok: true; data: PackageReviewData }
  | { ok: false; status: number; message: string };

export interface FetchPackageOptions {
  accessToken: string;
  transactionId: string;
}

export async function fetchPackageReview(
  opts: FetchPackageOptions
): Promise<FetchPackageResult> {
  let res: Response;
  try {
    res = await fetch(
      `${VAULT_BASE_URL}/paperwork/agents/transactions/${opts.transactionId}/package`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${opts.accessToken}` },
        cache: "no-store",
      }
    );
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "network error",
    };
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, message: detail || res.statusText };
  }

  const json = (await res.json()) as Partial<PackageReviewData>;
  if (!json.package_plan) {
    return { ok: false, status: 502, message: "malformed package response" };
  }
  return {
    ok: true,
    data: {
      package_plan: json.package_plan,
      form_status: json.form_status ?? {},
    },
  };
}
