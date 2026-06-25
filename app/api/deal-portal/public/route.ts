// POST /api/deal-portal/public — Proxy to Vault for public portal access
// No auth required — this is a public endpoint for clients

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";
export const PUBLIC_ROUTE = true;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${VAULT_API_URL}/deal-portal/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying deal-portal/public:", error);
    return NextResponse.json(
      { error: "Failed to access portal" },
      { status: 500 }
    );
  }
}
