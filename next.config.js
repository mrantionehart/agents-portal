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

  // HOTFIX.1 — collapse the split-shell experience by routing the
  // legacy /dashboard URL into the AP2 home. Edge-level redirect; the
  // legacy file under app/dashboard/ remains in git history but is no
  // longer reachable. All other legacy routes preserved.
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/home',
        permanent: false, // 307 — let us tweak the target without browser cache lock-in
      },
    ];
  },
}

module.exports = nextConfig
