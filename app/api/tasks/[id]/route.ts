// PATCH /api/tasks/[id] — Proxy to Vault brokerage-tasks/[id] for status toggle
// Agents and OM can update task status (e.g. pending ↔ completed).

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization") || "";
    const body = await request.json();

    const response = await fetch(`${VAULT_API_URL}/brokerage-tasks/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying task update to Vault:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
