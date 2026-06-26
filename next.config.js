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
    ];
  },
}

module.exports = nextConfig
