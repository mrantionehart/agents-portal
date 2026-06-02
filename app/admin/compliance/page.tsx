// Phase 1 retirement redirect — brokers/admins operate in Vault.
// Original admin compliance UI is queued for Phase 3 deletion.
import { redirect } from 'next/navigation'

export default function AdminCompliancePage() {
  redirect('https://vault.hartfeltrealestate.com/compliance')
}
