// ============================================================================
// Matrix Simulator — Agent Portal feature posture
// ============================================================================
// Mirrors the Ring's dark-honest flag pattern. Default OFF: the nav entry and
// the surface render an honest "coming soon" state instead of calling Vault
// routes that would 404 while the feature is dark. Enabled for controlled UAT
// via NEXT_PUBLIC_MATRIX_SIMULATOR_ENABLED = "true".
// ============================================================================

export function matrixSimulatorEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MATRIX_SIMULATOR_ENABLED === "true";
}
