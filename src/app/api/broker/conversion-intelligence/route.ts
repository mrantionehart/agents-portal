// GET/POST /api/broker/conversion-intelligence — Proxy to Vault conversion intelligence API

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const { searchParams } = new URL(request.url);
    const params = searchParams.toString();

    const response = await fetch(`${VAULT_API_URL}/conversion-intelligence${params ? `?${params}` : ""}`, {
      method: "GET",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying conversion intelligence to Vault:", error);
    return NextResponse.json({ error: "Failed to fetch conversion intelligence" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const body = await request.json();

    const response = await fetch(`${VAULT_API_URL}/conversion-intelligence`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying conversion update to Vault:", error);
    return NextResponse.json({ error: "Failed to update conversion" }, { status: 500 });
  }
}
