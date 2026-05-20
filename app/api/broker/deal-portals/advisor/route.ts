// POST /api/broker/deal-portals/advisor — Create Deal Portal via Vault
// GET  /api/broker/deal-portals/advisor — List advisor's portals

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const response = await fetch(`${VAULT_API_URL}/deal-portals/advisor`, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying deal portals:", error);
    return NextResponse.json({ error: "Failed to fetch deal portals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const body = await request.json();
    const response = await fetch(`${VAULT_API_URL}/deal-portals/advisor`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error creating deal portal:", error);
    return NextResponse.json({ error: "Failed to create deal portal" }, { status: 500 });
  }
}
