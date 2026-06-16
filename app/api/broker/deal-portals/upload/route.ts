// POST /api/broker/deal-portals/upload — Proxy file upload to Vault
import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const authHeader = request.headers.get("authorization") || "";
    const formData = await request.formData();

    const response = await fetch(`${VAULT_API_URL}/deal-portals/upload`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying deal portal upload:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
