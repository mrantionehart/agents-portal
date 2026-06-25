// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — CommandBar data loader (client hook)
// ============================================================================
// Lazily fetches the items the palette searches:
//   - transactions via the EXISTING Vault /api/platform/workspace
//   - clients via the EXISTING client_profiles table (RLS-gated)
//
// NO new endpoints, NO writes. Fetches once on first open and caches
// the result for the session.
// ============================================================================

"use client";

import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { CommandClient, CommandTxn } from "./actions";

const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_VAULT_API_URL ?? "https://vault.hartfeltrealestate.com/api"
).replace(/\/$/, "");

interface State {
  txns: CommandTxn[];
  clients: CommandClient[];
  loading: boolean;
  error: string | null;
}

export function useCommandData(active: boolean): State {
  const [state, setState] = useState<State>({
    txns: [],
    clients: [],
    loading: false,
    error: null,
  });
  const fetched = useRef(false);

  useEffect(() => {
    if (!active || fetched.current) return;
    fetched.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setState({ txns: [], clients: [], loading: false, error: "Not signed in" });
          return;
        }

        // ── transactions via existing workspace endpoint ───────────
        let txnItems: CommandTxn[] = [];
        try {
          const res = await fetch(`${VAULT_API_URL}/platform/workspace?scope=mine`, {
            credentials: "omit",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = await res.json();
            const items: any[] = Array.isArray(body?.items) ? body.items : [];
            txnItems = items.slice(0, 50).map((c) => ({
              id: c.transaction_id,
              title: c.property_address || "(no address)",
              subtitle: [c.client_name || null, c.transaction_type || null].filter(Boolean).join(" · "),
            }));
          } else if (res.status === 403) {
            // Office scope fallback (broker tier) — same pattern as AP2.1B
            const fb = await fetch(`${VAULT_API_URL}/platform/workspace?scope=office`, {
              credentials: "omit",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (fb.ok) {
              const body = await fb.json();
              const items: any[] = Array.isArray(body?.items) ? body.items : [];
              txnItems = items.slice(0, 50).map((c) => ({
                id: c.transaction_id,
                title: c.property_address || "(no address)",
                subtitle: [c.client_name || null, c.transaction_type || null].filter(Boolean).join(" · "),
              }));
            }
          }
        } catch { /* fall through; client search still works */ }

        // ── clients via existing client_profiles table (RLS-gated) ─
        let clientItems: CommandClient[] = [];
        try {
          const { data: rows, error } = await supabase
            .from("client_profiles")
            .select("id, full_name, email, phone")
            .order("updated_at", { ascending: false })
            .limit(200);
          if (!error && Array.isArray(rows)) {
            clientItems = rows.map((r: any) => ({
              id: r.id,
              title: r.full_name || "(no name)",
              subtitle: [r.email || null, r.phone || null].filter(Boolean).join(" · "),
            }));
          }
        } catch { /* fall through */ }

        setState({ txns: txnItems, clients: clientItems, loading: false, error: null });
      } catch (err) {
        setState({
          txns: [],
          clients: [],
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load",
        });
      }
    })();
  }, [active]);

  return state;
}
