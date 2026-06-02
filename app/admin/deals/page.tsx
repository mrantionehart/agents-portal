// Phase 1 retirement redirect — brokers/admins operate in Vault.
// Original admin deals UI is queued for Phase 3 deletion.
import { redirect } from 'next/navigation'

export default function AdminDealsPage() {
  redirect('https://vault.hartfeltrealestate.com/transactions')
}
