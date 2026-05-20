// GET/POST /api/broker/investor-rooms — Proxy to Vault investor rooms API

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const { searchParams } = new URL(request.url);
    const params = searchParams.toString();

    const response = await fetch(`${VAULT_API_URL}/investor-rooms${params ? `?${params}` : ""}`, {
      method: "GET",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying investor rooms to Vault:", error);
    return NextResponse.json({ error: "Failed to fetch investor rooms" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const body = await request.json();

    const response = await fetch(`${VAULT_API_URL}/investor-rooms`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying investor room creation to Vault:", error);
    return NextResponse.json({ error: "Failed to create investor room" }, { status: 500 });
  }
}
