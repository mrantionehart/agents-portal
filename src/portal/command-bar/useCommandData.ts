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

        // ── clients via existing client_profiles table ────────────
        // RLS gates this SELECT in production (tenant + ownership for
        // agents; tenant for broker tier), but the client never asked
        // for anything, so if RLS ever failed open the browser would
        // receive every row the table has. Defense-in-depth: resolve
        // the caller's own tenant + role first and apply the same
        // predicates the server routes do. If either lookup fails,
        // return no clients at all rather than fall through to an
        // unfiltered SELECT.
        let clientItems: CommandClient[] = [];
        try {
          const userId = data.session?.user?.id ?? null;
          if (!userId) throw new Error("no_user");

          const { data: me } = await supabase
            .from("profiles")
            .select("role, tenant_id")
            .eq("id", userId)
            .maybeSingle();
          const callerRole = (me?.role as string | null) ?? null;
          const callerTenantId = (me?.tenant_id as string | null) ?? null;
          if (!callerRole || !callerTenantId) throw new Error("no_scope");

          const BROKER_TIER = ["broker", "admin", "office_manager"];
          const isBroker = BROKER_TIER.includes(callerRole);

          let q = supabase
            .from("client_profiles")
            .select("id, full_name, email, phone")
            .eq("tenant_id", callerTenantId)
            .order("updated_at", { ascending: false })
            .limit(200);

          if (!isBroker) {
            // Agent / new_agent — mirror the server policy:
            //   assigned_agent_id = me OR claimed_by = me
            //   OR (visibility = 'dispo_feed' AND status = 'dispo')
            q = q.or(
              `assigned_agent_id.eq.${userId},claimed_by.eq.${userId},and(visibility.eq.dispo_feed,status.eq.dispo)`,
            );
          }

          const { data: rows, error } = await q;
          if (!error && Array.isArray(rows)) {
            clientItems = rows.map((r: any) => ({
              id: r.id,
              title: r.full_name || "(no name)",
              subtitle: [r.email || null, r.phone || null].filter(Boolean).join(" · "),
            }));
          }
        } catch { /* fall through — command bar still shows transactions */ }

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
