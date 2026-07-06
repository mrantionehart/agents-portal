// POST /api/deal-portal/inventory/interest — Proxy to Vault for buyer interest submission
// No auth required — public endpoint for buyers

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";
export const PUBLIC_ROUTE = true;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${VAULT_API_URL}/deal-portal/inventory/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying deal-portal/inventory/interest:", error);
    return NextResponse.json({ error: "Failed to submit interest" }, { status: 500 });
  }
}
