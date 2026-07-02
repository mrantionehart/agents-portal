// GET /api/tasks — Proxy to Vault brokerage-tasks API
// Agents and OM can view tasks assigned to them.

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const { searchParams } = new URL(request.url);
    const params = searchParams.toString();

    const response = await fetch(`${VAULT_API_URL}/brokerage-tasks${params ? `?${params}` : ""}`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying brokerage tasks to Vault:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}
