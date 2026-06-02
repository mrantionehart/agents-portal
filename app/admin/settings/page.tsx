// Phase 1 retirement redirect — brokers/admins operate in Vault.
// Original admin settings UI is queued for Phase 3 deletion.
import { redirect } from 'next/navigation'

export default function AdminSettingsRoutePage() {
  redirect('https://vault.hartfeltrealestate.com/settings')
}
