// Phase 1 retirement redirect — brokers/admins operate in Vault.
// Original admin commissions UI is queued for Phase 3 deletion.
import { redirect } from 'next/navigation'

export default function AdminCommissionsPage() {
  redirect('https://vault.hartfeltrealestate.com/commissions')
}
