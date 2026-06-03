// GET /api/cma/autocomplete?q=13724+SW+92nd
// Returns matching property addresses from Rentcast for autocomplete

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";

const RENTCAST_KEY = process.env.RENTCAST_API_KEY || "";

// Build a fresh NextResponse on every call — module-scope instances
// have their body stream consumed on first return (Sprint 5A lesson).
const tooManyRequests = () =>
  NextResponse.json({ error: "Too many requests" }, { status: 429 });

export async function GET(req: NextRequest) {
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim() || "";
    if (q.length < 5) {
      // Cheap early return — no Rentcast quota burnt — so do NOT
      // consume rate-limit slots on UI-pre-filtered short queries.
      return NextResponse.json([]);
    }

    if (!RENTCAST_KEY) {
      console.warn("[CMA Autocomplete] No RENTCAST_API_KEY configured");
      return NextResponse.json([]);
    }

    // ---- Rate limit: per-IP minute + day (Sprint 5C: L2) ----
    // Protects paid Rentcast quota from automated abuse. Runs AFTER
    // the cheap q<5 short-circuit (which never hits Rentcast) and
    // BEFORE the Rentcast fetch (which does). Two sliding-window
    // buckets so short bursts AND sustained low-rate scraping are
    // both caught. Generic 429 — do not leak quota internals.
    const ip = clientIp(req.headers);
    const minuteCheck = await checkRateLimit(
      "cma-autocomplete-ip",
      ip,
      30,
      "1 m"
    );
    if (!minuteCheck.ok) return tooManyRequests();

    const dayCheck = await checkRateLimit(
      "cma-autocomplete-day-ip",
      ip,
      300,
      "1 d"
    );
    if (!dayCheck.ok) return tooManyRequests();
    // ---------------------------------------------------------

    const params = new URLSearchParams();
    params.set("address", q);
    params.set("limit", "8");

    const res = await fetch(`https://api.rentcast.io/v1/properties?${params.toString()}`, {
      headers: { "X-Api-Key": RENTCAST_KEY },
    });

    if (!res.ok) {
      console.warn("[CMA Autocomplete] Rentcast returned", res.status);
      return NextResponse.json([]);
    }

    let data: any;
    try {
      const text = await res.text();
      if (!text || text.trim().startsWith("<!")) return NextResponse.json([]);
      data = JSON.parse(text);
    } catch {
      return NextResponse.json([]);
    }

    if (!Array.isArray(data)) {
      return NextResponse.json([]);
    }

    const suggestions = data.map((p: any) => ({
      address: p.formattedAddress || `${p.addressLine1}, ${p.city}, ${p.state} ${p.zipCode}`,
      street: p.addressLine1 || "",
      city: p.city || "",
      state: p.state || "",
      zip: p.zipCode || "",
      beds: p.bedrooms || 0,
      baths: p.bathrooms || 0,
      sqft: p.squareFootage || 0,
      yearBuilt: p.yearBuilt || 0,
      propertyType: p.propertyType || "",
    }));

    return NextResponse.json(suggestions);
  } catch (err: any) {
    console.error("Autocomplete error:", err.message);
    return NextResponse.json([]);
  }
}
