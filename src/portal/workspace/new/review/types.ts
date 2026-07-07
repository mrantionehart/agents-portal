// ============================================================================
// TRANSACTION OS 3.3C — Package Review types (portal mirror of the Vault plan)
// ============================================================================
// Mirrors the shape returned by Vault GET
// /api/paperwork/agents/transactions/[id]/package. The Vault module can't be
// imported cross-repo, so these are the portal-side render contracts. Pure
// types — no logic.
// ============================================================================

export type PackageFormSource = "rule_engine" | "optional_catalog" | "rider_catalog";

export interface PackageForm {
  form_id: string;
  label: string;
  category: string;
  reason: string;
  source: PackageFormSource;
  required: boolean;
  optional: boolean;
  rider: boolean;
  locked: boolean;
  suggested: boolean;
  selected: boolean;
}

export interface SearchableForm {
  form_id: string;
  label: string;
  category: string;
}

export interface PackageGates {
  plan_available: boolean;
  can_prepare_package: boolean;
  can_send_for_signature: boolean;
  recommended_actions: string[];
  ready_forms: string[];
  blocked_forms: string[];
}

export interface SelectionRules {
  required_locked: boolean;
  optional_selectable: boolean;
  riders_selectable: boolean;
  riders_searchable: boolean;
}

export interface TransactionBlueprint {
  transaction_id: string;
  type_key: string;
  required: string[];
  optional_available: string[];
  rider_available: string[];
  optional_selected: string[];
  rider_selected: string[];
  all_selected: string[];
}

export interface PackageSummary {
  required_count: number;
  optional_count: number;
  optional_selected_count: number;
  rider_count: number;
  rider_selected_count: number;
  searchable_count: number;
  total_in_package: number;
}

export interface PackagePlan {
  transaction_id: string;
  type_key: string;
  required_forms: PackageForm[];
  optional_forms: PackageForm[];
  suggested_riders: PackageForm[];
  searchable_forms: SearchableForm[];
  selection_rules: SelectionRules;
  locked_forms: string[];
  reasons: Record<string, string>;
  package_gates: PackageGates;
  blueprint: TransactionBlueprint;
  summary: PackageSummary;
}

export interface FormStatusLite {
  form_instance_id: string;
  status: string;
  disposition: string;
  status_label: string;
  downloadable: boolean;
  generatable: boolean;
}

export type FormStatusMap = Record<string, FormStatusLite>;

export interface PackageReviewData {
  package_plan: PackagePlan;
  form_status: FormStatusMap;
}
