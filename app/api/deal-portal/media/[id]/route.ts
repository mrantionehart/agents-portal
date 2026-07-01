// GET /api/deal-portal/media/[id] — Proxy to Vault media proxy
// No auth required — the Vault endpoint validates the portal access_token.
// This keeps the Supabase domain hidden from the buyer.

import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export const dynamic = "force-dynamic";
export const PUBLIC_ROUTE = true;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const response = await fetch(
      `${VAULT_API_URL}/deal-portal/media/${id}?token=${encodeURIComponent(token)}`,
      { method: "GET" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Media not found" },
        { status: response.status }
      );
    }

    // Stream the file content back with the same headers
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error proxying deal-portal media:", error);
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 500 }
    );
  }
}
