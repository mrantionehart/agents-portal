// ============================================================================
// AGENT PORTAL 2.0 — HOTFIX.AP.STR.001 — Buildings
// ============================================================================
// Native (portal) route for the Airbnb-friendly building directory. Renders
// inside the Portal 2.0 shell (Sidebar / TopBar from the (portal) layout).
//
// Presentation only: BuildingsClient fetches the UNCHANGED Vault-backed proxy
// /api/broker/str-directory on the client (Supabase session cookie). No
// server data fetch, no new endpoint, no DB access, no contract change.
// The legacy /str-directory route + STRDirectoryScreen are left untouched and
// are never linked from this shell.
// ============================================================================

import BuildingsClient from "@/src/portal/buildings/BuildingsClient";

export const metadata = {
  title: "Buildings",
};

export default function BuildingsPage() {
  return <BuildingsClient />;
}
