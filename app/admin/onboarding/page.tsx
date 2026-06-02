// Phase 1 retirement redirect — brokers/admins operate in Vault.
// Original admin onboarding UI is queued for Phase 3 deletion.
import { redirect } from 'next/navigation'

export default function AdminOnboardingPage() {
  redirect('https://vault.hartfeltrealestate.com/onboarding-pipeline')
}
