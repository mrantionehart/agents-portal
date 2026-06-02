// Phase 1 retirement redirect — brokers/admins operate in Vault.
// Original BrokerPerformanceDashboard UI is queued for Phase 3 deletion.
import { redirect } from 'next/navigation'

export default function BrokerDashboardPage() {
  redirect('https://vault.hartfeltrealestate.com/dashboard')
}
