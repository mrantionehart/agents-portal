// Phase 1 retirement redirect — brokers/admins operate in Vault.
// Original brokerage management UI is queued for Phase 3 deletion.
import { redirect } from 'next/navigation'

export default function BrokeragePage() {
  redirect('https://vault.hartfeltrealestate.com/agents')
}
