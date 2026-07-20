// ============================================================================
// HOTFIX.AP.STR.001 — Buildings (Portal 2.0 view)
// ============================================================================
// Dark-themed Portal 2.0 surface over the Vault-backed Airbnb-friendly
// building set. Presentation only — all auth / gating live in Vault behind
// the unchanged /api/broker/str-directory proxy.
//
// States: loading · error (retry) · empty · populated. Search is debounced
// over the returned dataset. No rental-permission or "all buildings" claim.
// ============================================================================

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Search, AlertCircle, ShieldAlert } from "lucide-react";

import {
  BUILDINGS_PAGE_TITLE,
  BUILDINGS_CATEGORY_LABEL,
  BUILDINGS_INTRO_COPY,
  COMPLIANCE_DISCLAIMER,
  categoryMeta,
  verificationMeta,
  fetchAirbnbFriendlyBuildings,
  type Building,
} from "./model";

type Status = "loading" | "error" | "empty" | "ready";

export default function BuildingsClient() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    try {
      const res = await fetchAirbnbFriendlyBuildings({
        search,
        page: 1,
        limit: 50,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      setBuildings(res.buildings);
      setStatus(res.buildings.length === 0 ? "empty" : "ready");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setStatus("error");
    }
  }, [search]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load, reloadKey]);

  return (
    <div className="text-[#F1F1F3]">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[#71717A] text-xs font-medium uppercase tracking-wide mb-2">
          <Building2 className="h-4 w-4" aria-hidden />
          Directory
        </div>
        <h1 className="text-[1.875rem] font-semibold tracking-tight text-[#F1F1F3]">
          {BUILDINGS_PAGE_TITLE}
        </h1>

        {/* Active category — single labeled section, not a filter control */}
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-3 py-1 text-sm font-medium text-[#E8D5A3]">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#C9A84C]"
          />
          {BUILDINGS_CATEGORY_LABEL}
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#A1A1AA]">
          {BUILDINGS_INTRO_COPY}
        </p>
      </header>

      {/* Search */}
      <div className="mb-5">
        <label htmlFor="buildings-search" className="sr-only">
          Search Airbnb-friendly buildings
        </label>
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]"
            aria-hidden
          />
          <input
            id="buildings-search"
            type="search"
            role="searchbox"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by building, address, or neighborhood"
            className="w-full rounded-md border border-[#1a1a2e] bg-[#0b0b10] py-2 pl-9 pr-3 text-sm text-[#F1F1F3] placeholder:text-[#52525B] focus:border-[#C9A84C]/50 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/40"
          />
        </div>
      </div>

      {/* Body */}
      {status === "loading" && (
        <div
          data-testid="buildings-loading"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-live="polite"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border border-[#1a1a2e] bg-[#11111a]"
            />
          ))}
          <span className="sr-only">Loading buildings…</span>
        </div>
      )}

      {status === "error" && (
        <div
          data-testid="buildings-error"
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border border-[#3a1d1d] bg-[#1a1010] p-5"
        >
          <div className="flex items-center gap-2 text-[#f87171]">
            <AlertCircle className="h-5 w-5" aria-hidden />
            <span className="font-medium">Couldn’t load buildings</span>
          </div>
          <p className="text-sm text-[#A1A1AA]">
            The directory didn’t respond. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/15 px-3 py-1.5 text-sm font-medium text-[#E8D5A3] hover:bg-[#C9A84C]/25 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/40"
          >
            Try again
          </button>
        </div>
      )}

      {status === "empty" && (
        <div
          data-testid="buildings-empty"
          className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-8 text-center"
        >
          <Building2 className="mx-auto h-6 w-6 text-[#52525B]" aria-hidden />
          <p className="mt-3 text-sm font-medium text-[#F1F1F3]">
            {search ? "No matching buildings" : "No buildings to show yet"}
          </p>
          <p className="mt-1 text-sm text-[#71717A]">
            {search
              ? "Try a different building, address, or neighborhood."
              : "The Airbnb-friendly set is currently empty."}
          </p>
        </div>
      )}

      {status === "ready" && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => {
            const cat = categoryMeta(b.category);
            const ver = verificationMeta(b.hoa_verification);
            return (
              <li
                key={b.id}
                className="rounded-lg border border-[#1a1a2e] bg-[#11111a] p-4 transition-colors hover:border-[#252538]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#F1F1F3]">{b.name}</h2>
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                    style={{ color: cat.tint, borderColor: cat.border }}
                  >
                    {cat.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  {b.address}
                  {b.city ? ` · ${b.city}` : ""}
                  {b.neighborhood ? ` · ${b.neighborhood}` : ""}
                </p>
                <p className="mt-2 text-[11px] text-[#71717A]">
                  <span aria-hidden>{ver.emoji} </span>
                  {ver.label}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Standing compliance disclaimer — always visible, never a claim. */}
      <aside className="mt-8 flex items-start gap-2 rounded-lg border border-[#1a1a2e] bg-[#0b0b10] p-4 text-xs leading-relaxed text-[#71717A]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#71717A]" aria-hidden />
        <span>{COMPLIANCE_DISCLAIMER}</span>
      </aside>
    </div>
  );
}
