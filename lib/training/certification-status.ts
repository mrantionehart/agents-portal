// HR-WORKFLOW-3 — what the agent is told about their HartFelt Ready
// certification. Vault decides the status (from the agent's own pipeline
// row); this only words it. An older Vault response without the field
// renders nothing rather than guessing.
export type CertificationStatus =
  | 'certified'
  | 'certified_legacy'
  | 'changes_requested'
  | 'awaiting_broker'
  | 'in_progress'

export interface Certification {
  status: CertificationStatus
  certified_at: string | null
  changes_requested: { at: string; note: string } | null
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function certificationMessage(c: Certification | null | undefined): string | null {
  if (!c) return null
  switch (c.status) {
    case 'certified':
    case 'certified_legacy':
      return `HartFelt Ready™ Certified${c.certified_at ? ` on ${day(c.certified_at)}` : ''} by your Broker of Record.`
    case 'changes_requested':
      return `Your Broker of Record requested changes before certifying: ${c.changes_requested?.note ?? ''}`.trim()
    case 'awaiting_broker':
      return 'All requirements met. Awaiting your Broker of Record’s approval to certify.'
    default:
      return null
  }
}
