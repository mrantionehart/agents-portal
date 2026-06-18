import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const url = `${VAULT_API_URL}/contract-training${qs ? `?${qs}` : ""}`;
    const response = await fetch(url, {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying contract training:", error);
    return NextResponse.json({ error: "Failed to fetch contract training" }, { status: 500 });
  }
}
