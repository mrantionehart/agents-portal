// GET /api/broker/str-directory — Proxy to Vault STR directory API
// Portal is presentation-only. All auth, rate limiting, logging, and
// field-gating happen in Vault. Portal forwards query params and auth.

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get("authorization") || "";

    // Forward all query params to Vault as-is
    const vaultUrl = `${VAULT_API_URL}/str-directory?${searchParams.toString()}`;

    const response = await fetch(vaultUrl, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying STR directory from Vault:", error);
    return NextResponse.json(
      { error: "Failed to fetch STR directory" },
      { status: 500 }
    );
  }
}
