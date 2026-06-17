// POST /api/broker/deal-portals/upload — Proxy file upload to Vault
import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // PORTAL.4 (2026-06-16) — pre-fix this line discarded requireAuth()'s
    // return value, so unauthenticated requests fell through to
    // request.formData() and the Vault upload fetch. Vault's downstream
    // Bearer check still rejected, but the proxy wasted bandwidth on the
    // file body and silently violated the CI route-guard pattern documented
    // in lib/security/withAuth.ts:100-104. Per the discriminated-union
    // contract, return the 401 response immediately when auth fails.
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const authHeader = request.headers.get("authorization") || "";
    const formData = await request.formData();

    const response = await fetch(`${VAULT_API_URL}/deal-portals/upload`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying deal portal upload:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
