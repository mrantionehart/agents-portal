#!/usr/bin/env python3
"""Pull YouTube video IDs from the 4 HartFelt Ready playlists and upsert them
into Supabase `training_videos`.

Usage:
    python3 scripts/sync_youtube_ids.py \
        --credentials "/path/to/youtube_credentials.txt" \
        --supabase-url "$NEXT_PUBLIC_SUPABASE_URL" \
        --supabase-key "$SUPABASE_SERVICE_ROLE_KEY" \
        [--dry-run]

The credentials file must contain lines like:
    api_key=AIzaSy...
    playlist_vol1_en=PLfbQHubWyWTnmFmYZwBjfRwTnK3wgLNbe
    playlist_vol1_es=PLfbQHubWyWTlGgOi1pQmUtolyPNo-DNRK
    playlist_vol2_en=PLfbQHubWyWTlsj6aNOiosukIptArblFn1
    playlist_vol2_es=PLfbQHubWyWTkOkMJH-9ka32w-vB0oL4ze

The script:
  1. Calls `playlistItems.list` for each playlist (paginated, 50 per page).
  2. Parses each video title for a "Video X.Y" or "HartFelt Ready X.Y" pattern
     to extract (volume, video_num).
  3. Upserts `youtube_id_en` / `youtube_id_es` into `training_videos`,
     matching on (volume, video_num).

If `--dry-run` is set, prints the plan without calling Supabase.
"""
import argparse
import json
import os
import re
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

YT_BASE = "https://www.googleapis.com/youtube/v3/playlistItems"

VID_PATTERNS = [
    re.compile(r"V(\d+)\.(\d+[ab]?)", re.IGNORECASE),   # "V1.1"
    re.compile(r"Video[_ ](\d+)\.(\d+[ab]?)"),           # "Video 1.1"
    re.compile(r"(\d+)\.(\d+[ab]?)"),                    # bare "1.1" as fallback
]


def parse_credentials(path: str) -> dict:
    out = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def fetch_playlist_items(playlist_id: str, api_key: str) -> list:
    """Return list of {title, video_id} for every item in a playlist."""
    items = []
    page_token = None
    while True:
        params = {
            "part": "snippet",
            "playlistId": playlist_id,
            "maxResults": 50,
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token
        url = f"{YT_BASE}?{urlencode(params)}"
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req) as resp:
            data = json.loads(resp.read())
        for it in data.get("items", []):
            snip = it.get("snippet", {})
            items.append({
                "title": snip.get("title", ""),
                "video_id": snip.get("resourceId", {}).get("videoId"),
                "position": snip.get("position"),
            })
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return items


def extract_video_num(title: str) -> tuple:
    """Return (volume_hint, video_num) or (None, None) if no match.

    volume_hint is the integer part of X.Y, which matches our migration
    convention where video_nums 1–7 belong to Vol 1 and 8–13 belong to Vol 2.
    """
    for pat in VID_PATTERNS:
        m = pat.search(title)
        if m:
            major = int(m.group(1))
            minor = m.group(2)
            return (major, f"{major}.{minor}")
    return (None, None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--credentials", required=True)
    ap.add_argument("--supabase-url")
    ap.add_argument("--supabase-key")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out-sql", help="Also write UPDATE statements to this .sql file")
    args = ap.parse_args()

    creds = parse_credentials(args.credentials)
    api_key = creds.get("api_key")
    if not api_key:
        print("ERROR: api_key missing from credentials file", file=sys.stderr)
        sys.exit(1)

    playlists = {
        (1, "en"): creds.get("playlist_vol1_en"),
        (1, "es"): creds.get("playlist_vol1_es"),
        (2, "en"): creds.get("playlist_vol2_en"),
        (2, "es"): creds.get("playlist_vol2_es"),
    }
    missing = [f"playlist_vol{v}_{l}" for (v, l), p in playlists.items() if not p]
    if missing:
        print(f"ERROR: missing playlist IDs: {missing}", file=sys.stderr)
        sys.exit(1)

    # (volume, video_num) -> {en: id, es: id}
    ids = {}
    for (vol, lang), pid in playlists.items():
        print(f"Fetching {lang} playlist (vol {vol}): {pid}")
        items = fetch_playlist_items(pid, api_key)
        print(f"  got {len(items)} items")
        for it in items:
            major, vnum = extract_video_num(it["title"])
            if not vnum:
                print(f"  WARN: cannot parse video_num from title: {it['title']!r}")
                continue
            # Normalize to the video's actual volume (1 if major in 1..7, else 2)
            actual_vol = 1 if major and major <= 7 else 2
            key = (actual_vol, vnum)
            ids.setdefault(key, {})[lang] = it["video_id"]

    print(f"\nResolved {len(ids)} unique (volume, video_num) pairs")

    # Emit UPDATE statements
    updates = []
    for (vol, vnum), langs in sorted(ids.items()):
        sets = []
        if "en" in langs:
            sets.append(f"youtube_id_en = '{langs['en']}'")
        if "es" in langs:
            sets.append(f"youtube_id_es = '{langs['es']}'")
        if not sets:
            continue
        updates.append(
            f"UPDATE public.training_videos SET {', '.join(sets)}, updated_at = NOW() "
            f"WHERE volume = {vol} AND video_num = '{vnum}';"
        )

    print(f"Generated {len(updates)} UPDATE statements")

    if args.out_sql:
        with open(args.out_sql, "w") as f:
            f.write("-- Auto-generated by sync_youtube_ids.py\n")
            f.write("\n".join(updates) + "\n")
        print(f"Wrote SQL to {args.out_sql}")

    if args.dry_run:
        print("\n--- DRY RUN: first 5 UPDATEs ---")
        for u in updates[:5]:
            print(u)
        return

    if not args.supabase_url or not args.supabase_key:
        print("ERROR: provide --supabase-url and --supabase-key (or use --dry-run)",
              file=sys.stderr)
        sys.exit(1)

    # Use Supabase REST /rest/v1/rpc? Actually easier: PostgREST PATCH on the table.
    # But we need raw SQL. Easiest: use the Supabase Management API exec_sql endpoint,
    # or just dump SQL and let the user pipe it to `supabase db push`/psql.
    print("\nApplying updates via Supabase REST (PATCH per row)...")
    import urllib.request
    for (vol, vnum), langs in sorted(ids.items()):
        body = {}
        if "en" in langs:
            body["youtube_id_en"] = langs["en"]
        if "es" in langs:
            body["youtube_id_es"] = langs["es"]
        qs = urlencode({"volume": f"eq.{vol}", "video_num": f"eq.{vnum}"})
        url = f"{args.supabase_url}/rest/v1/training_videos?{qs}"
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            headers={
                "Content-Type": "application/json",
                "apikey": args.supabase_key,
                "Authorization": f"Bearer {args.supabase_key}",
                "Prefer": "return=minimal",
            },
            method="PATCH",
        )
        try:
            urllib.request.urlopen(req)
            print(f"  OK v{vol} {vnum}")
        except Exception as e:
            print(f"  FAIL v{vol} {vnum}: {e}")


if __name__ == "__main__":
    main()
