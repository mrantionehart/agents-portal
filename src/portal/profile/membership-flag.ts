// MDC-1 — My Memberships & MLS is DARK until separately authorized.
// Literal read so Next inlines it into the client bundle. While off, the
// section renders nothing and makes no API call; the routes return 404.
export function membershipSectionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MEMBERSHIP_COMPLIANCE_ENABLED === 'true'
}
