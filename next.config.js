/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable static exports for auth pages
  output: 'standalone',

  // HOTFIX.1 + R1/R8 — edge-level redirects that collapse duplicate
  // legacy routes into the AP2 shell. Each source matches EXACTLY
  // (no implicit sub-route capture) — so /transactions/new still
  // serves the existing legacy form for the R1 create entry point.
  // Permanent: false (307) so we can re-target without browser cache
  // lock-in. All un-listed legacy routes remain untouched.
  async redirects() {
    return [
      // HOTFIX.1 — old post-login landing → AP2 home.
      { source: '/dashboard',   destination: '/home',      permanent: false },

      // R1/R8 — fold the duplicate "list of transactions" surfaces
      // into the single AP2 dashboard. /transactions/new is NOT
      // matched (exact-match source), so the legacy creation form
      // remains reachable from the R1 entry points.
      { source: '/transactions', destination: '/workspace', permanent: false },
      { source: '/deals',        destination: '/workspace', permanent: false },
      { source: '/pipeline',     destination: '/workspace', permanent: false },

      // R8 — sunset the duplicate legacy chat page in favour of AP2.1H /ai.
      { source: '/ai-chat',      destination: '/ai',        permanent: false },

      // R2A — fold legacy /deal-portals into the AP2 workspace shell.
      // /portal/[token] is the public client-facing page and is NOT
      // matched (exact-match source).
      { source: '/deal-portals', destination: '/workspace/portals', permanent: false },

      // R8 — Resources + Scripts are now tabs inside the Training Hub
      // (see R5). Exact-match sources, so /scripts/<id> (none exist
      // today) and any future sub-routes would NOT be captured.
      // Query strings on the source carry through to the destination,
      // e.g. /scripts?category=buyer → /training?tab=scripts&category=buyer.
      { source: '/resources', destination: '/training?tab=resources', permanent: false },
      { source: '/scripts',   destination: '/training?tab=scripts',   permanent: false },

      // R8 — Marketing Resources was a small static page superseded
      // by the Training Hub's Resources tab. Folded into the same
      // destination as /resources to preserve agent intent.
      { source: '/marketing-resources', destination: '/training?tab=resources', permanent: false },
    ];
  },
}

module.exports = nextConfig
