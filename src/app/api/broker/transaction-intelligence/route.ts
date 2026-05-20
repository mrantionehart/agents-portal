// GET/POST /api/broker/transaction-intelligence — Proxy to Vault transaction intelligence API

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const { searchParams } = new URL(request.url);
    const params = searchParams.toString();

    const response = await fetch(`${VAULT_API_URL}/transaction-intelligence${params ? `?${params}` : ""}`, {
      method: "GET",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying transaction intelligence to Vault:", error);
    return NextResponse.json({ error: "Failed to fetch transaction intelligence" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const body = await request.json();

    const response = await fetch(`${VAULT_API_URL}/transaction-intelligence`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying transaction intelligence to Vault:", error);
    return NextResponse.json({ error: "Failed to process transaction" }, { status: 500 });
  }
}
