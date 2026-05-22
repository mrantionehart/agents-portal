// Portal proxy → Vault /api/news
import { NextRequest, NextResponse } from "next/server";
import { VAULT_API_URL } from "@/lib/vault-client";

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit") || "20";
  try {
    const res = await fetch(`${VAULT_API_URL}/news?limit=${limit}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 900 }, // cache 15 min at edge
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ articles: [], count: 0 }, { status: 502 });
  }
}
