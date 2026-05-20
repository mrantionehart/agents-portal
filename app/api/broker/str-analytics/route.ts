// POST /api/broker/str-analytics — Proxy to Vault STR analytics
// Portal is presentation-only. All auth and logging happen in Vault.

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const body = await request.json();

    const response = await fetch(`${VAULT_API_URL}/str-analytics`, {
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
    console.error("Error proxying STR analytics to Vault:", error);
    return NextResponse.json(
      { error: "Failed to log STR analytics" },
      { status: 500 }
    );
  }
}
