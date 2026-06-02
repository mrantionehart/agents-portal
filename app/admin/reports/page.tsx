// Phase 1 retirement redirect — brokers/admins operate in Vault.
// Original admin reports UI is queued for Phase 3 deletion.
import { redirect } from 'next/navigation'

export default function AdminReportsPage() {
  redirect('https://vault.hartfeltrealestate.com/reports')
}
