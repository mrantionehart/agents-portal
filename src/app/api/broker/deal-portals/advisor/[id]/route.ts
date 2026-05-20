// GET /api/broker/deal-portals/advisor/[id] — Proxy portal detail to Vault

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const { id } = await params;
    const response = await fetch(`${VAULT_API_URL}/deal-portals/advisor/${id}`, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying portal detail:", error);
    return NextResponse.json({ error: "Failed to fetch portal detail" }, { status: 500 });
  }
}
