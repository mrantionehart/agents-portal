// GET /api/broker/brokerage-intelligence — Proxy to Vault brokerage intelligence API

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const { searchParams } = new URL(request.url);
    const params = searchParams.toString();

    const response = await fetch(`${VAULT_API_URL}/brokerage-intelligence${params ? `?${params}` : ""}`, {
      method: "GET",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying brokerage intelligence to Vault:", error);
    return NextResponse.json({ error: "Failed to fetch brokerage intelligence" }, { status: 500 });
  }
}
