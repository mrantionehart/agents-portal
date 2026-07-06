// GET /api/deal-portal/inventory?token=xxx — Proxy to Vault for public inventory
// No auth required — public endpoint for buyers

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";
export const PUBLIC_ROUTE = true;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get("token");
    const state = searchParams.get("state");
    const county = searchParams.get("county");
    const property_type = searchParams.get("property_type");
    const status = searchParams.get("status");

    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const params = new URLSearchParams({ token });
    if (state) params.append("state", state);
    if (county) params.append("county", county);
    if (property_type) params.append("property_type", property_type);
    if (status) params.append("status", status);

    const response = await fetch(`${VAULT_API_URL}/deal-portal/inventory?${params.toString()}`);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying deal-portal/inventory:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}
