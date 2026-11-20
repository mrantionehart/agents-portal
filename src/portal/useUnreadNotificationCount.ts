"use client";
// LEAD-DISPO-QA (2026-11-19) — the TopBar bell was a placeholder with no count
// and no action, so an agent saw a new pooled lead only by opening the
// Notifications page. Same source and rule as that page: the caller's own
// rows, unread = read_at IS NULL, archived rows excluded. HEAD + count=exact,
// so no row content is read. Any failure ⇒ null (the badge hides; the bell
// still links to the page).
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase";

const REST_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/rest/v1`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const UNREAD_POLL_MS = 60_000;

export function parseContentRangeTotal(header: string | null): number | null {
  const m = header?.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

export async function fetchUnreadCount(userId: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const url =
      `${REST_BASE}/notifications?select=id` +
      `&user_id=eq.${encodeURIComponent(userId)}` +
      `&read_at=is.null&archived_at=is.null`;
    const res = await fetchImpl(url, {
      method: "HEAD",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, Prefer: "count=exact", Range: "0-0" },
    });
    if (!res.ok && res.status !== 206) return null;
    return parseContentRangeTotal(res.headers.get("content-range"));
  } catch {
    return null;
  }
}

export function useUnreadNotificationCount(userId: string | null | undefined): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    const load = () => fetchUnreadCount(userId).then((n) => { if (live) setCount(n); });
    void load();
    const t = setInterval(load, UNREAD_POLL_MS);
    return () => { live = false; clearInterval(t); };
  }, [userId]);
  return count;
}
