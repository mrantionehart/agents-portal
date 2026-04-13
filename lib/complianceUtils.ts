// Stub file for compliance utilities
// This is a placeholder to allow the build to complete

export interface ComplianceStatus {
  id: string
  name: string
  status: string
  agentId?: string
  riskLevel?: string
  [key: string]: any
}

export interface OnboardingStep {
  id: string
  name: string
  title?: string
  completed: boolean
  description?: string
  [key: string]: any
}

export const complianceUtils = {
  checkCompliance: () => true,
}

export default complianceUtils
