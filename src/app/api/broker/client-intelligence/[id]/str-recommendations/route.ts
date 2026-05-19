// GET /api/broker/client-intelligence/[id]/str-recommendations
// Proxy to Vault STR recommendation engine
// Portal is presentation-only. All auth, scoring, and field-gating happen in Vault.

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization") || "";

    const vaultUrl = `${VAULT_API_URL}/client-intelligence/${id}/str-recommendations`;

    const response = await fetch(vaultUrl, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying STR recommendations from Vault:", error);
    return NextResponse.json(
      { error: "Failed to fetch STR recommendations" },
      { status: 500 }
    );
  }
}
