// Type Definitions for MLS & External System Integration
// Complete TypeScript interfaces for MLS listings, external services, and valuations

// ============================================================================
// MLS Listing Types
// ============================================================================

export type ListingType = 'residential' | 'commercial' | 'land' | 'multi-family'
export type ListingStatus = 'active' | 'pending' | 'sold' | 'withdrawn' | 'expired'

/**
 * Property details stored as JSONB
 */
export interface PropertyDetails {
  beds?: number
  baths?: number
  sqft?: number
  lot_size?: number
  year_built?: number
  features?: string[]
  photos_count?: number
  [key: string]: any
}

/**
 * Agent information
 */
export interface AgentInfo {
  name: string
  phone?: string
  email?: string
  brokerage?: string
  mls_id?: string
  [key: string]: any
}

/**
 * Core MLS Listing Record
 */
export interface MLSListing {
  id: string
  mls_number: string
  address: string
  city: string
  state: string
  zip: string
  listing_type: ListingType
  status: ListingStatus
  list_price?: number
  sold_price?: number
  price_per_sqft?: number
  list_date?: string
  sold_date?: string
  days_on_market?: number
  property_details: PropertyDetails
  listing_agent_info: AgentInfo
  buyer_agent_info?: AgentInfo
  mls_data_raw: Record<string, any>
  last_updated: string
  created_at: string
}

/**
 * MLS Search Query
 */
export interface MLSSearchQuery {
  address?: string
  city?: string
  state?: string
  zip?: string
  status?: ListingStatus
  listing_type?: ListingType
  price_min?: number
  price_max?: number
  list_date_from?: string
  list_date_to?: string
  beds_min?: number
  baths_min?: number
  sqft_min?: number
  page?: number
  limit?: number
}

/**
 * MLS Search Response
 */
export interface MLSSearchResponse {
  listings: MLSListing[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ============================================================================
// Transaction MLS Link Types
// ============================================================================

export type LinkStatus = 'linked' | 'unlinked' | 'auto_matched'

/**
 * Transaction-MLS Link Record
 */
export interface TransactionMLSLink {
  id: string
  transaction_id: string
  mls_number: string
  linked_by: string
  link_date: string
  status: LinkStatus
  auto_populated_fields: string[]
  created_at: string
  updated_at: string
}

/**
 * Link Transaction to MLS Request
 */
export interface LinkTransactionRequest {
  mls_number: string
}

// ============================================================================
// Third Party Service Account Types
// ============================================================================

export type ServiceType = 'title_company' | 'lender' | 'inspector' | 'appraisal' | 'docusign'
export type AuthMethod = 'api_key' | 'oauth2' | 'basic' | 'custom'
export type AccountStatus = 'active' | 'inactive' | 'testing' | 'error'

/**
 * Third Party Service Account
 */
export interface ServiceAccount {
  id: string
  broker_id: string
  service_type: ServiceType
  service_name: string
  account_id: string
  endpoint_url?: string
  auth_method: AuthMethod
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  status: AccountStatus
  last_test_at?: string
  last_error_message?: string
  created_at: string
  updated_at: string
  // Note: api_key is NOT returned in API responses for security
}

/**
 * Service Account Response (without credentials)
 */
export interface ServiceAccountResponse extends Omit<ServiceAccount, 'api_key'> {}

/**
 * Create Service Account Request
 */
export interface CreateServiceAccountRequest {
  service_type: ServiceType
  service_name: string
  account_id: string
  api_key?: string
  endpoint_url?: string
  auth_method?: AuthMethod
  contact_person?: string
  contact_email?: string
  contact_phone?: string
}

/**
 * Update Service Account Request
 */
export interface UpdateServiceAccountRequest {
  service_name?: string
  api_key?: string
  endpoint_url?: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  status?: AccountStatus
}

// ============================================================================
// External Service Request Types
// ============================================================================

export type RequestStatus = 'pending' | 'submitted' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
export type RequestType = 'title_search' | 'appraisal_order' | 'inspection_schedule' | 'loan_application' | 'custom'

/**
 * External Service Request Record
 */
export interface ExternalServiceRequest {
  id: string
  transaction_id: string
  service_account_id: string
  service_type: ServiceType
  request_type: RequestType
  status: RequestStatus
  external_id?: string
  request_data: Record<string, any>
  response_data?: Record<string, any>
  submitted_date?: string
  completed_date?: string
  due_date?: string
  retry_count: number
  last_retry_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

/**
 * Submit Service Request
 */
export interface SubmitServiceRequestPayload {
  service_type: ServiceType
  request_type: RequestType
  due_date?: string
  details: Record<string, any>
}

/**
 * Service Request Status Update (webhook from external system)
 */
export interface ServiceRequestStatusUpdate {
  external_id: string
  status: RequestStatus
  response_data?: Record<string, any>
  completed_date?: string
}

// ============================================================================
// Property Valuation Types
// ============================================================================

export type ValuationType = 'appraised_value' | 'tax_assessment' | 'zillow_estimate' | 'comparable_sales' | 'manual'

/**
 * Property Valuation Record
 */
export interface PropertyValuation {
  id: string
  transaction_id: string
  valuation_type: ValuationType
  valuation_date: string
  value_amount: number
  source?: string
  confidence_score: number // 0-1.0
  created_at: string
}

/**
 * Log Property Valuation Request
 */
export interface LogPropertyValuationRequest {
  valuation_type: ValuationType
  value_amount: number
  source?: string
  confidence_score?: number
}

/**
 * Property Valuation Summary
 */
export interface PropertyValuationSummary {
  property_address: string
  valuations: PropertyValuation[]
  average_value?: number
  value_range?: {
    min: number
    max: number
  }
  discrepancies?: string[]
}

// ============================================================================
// Comparable Sales Types
// ============================================================================

export type ComparableSource = 'mls_data' | 'public_records' | 'zillow' | 'redfin'

/**
 * Comparable Sale Record
 */
export interface ComparableSale {
  id: string
  market_area: string
  property_details: PropertyDetails & { address: string }
  sale_date: string
  sale_price: number
  days_on_market?: number
  price_per_sqft?: number
  source: ComparableSource
  source_id?: string
  created_at: string
}

/**
 * Comparable Sales Search
 */
export interface ComparableSalesSearch {
  market_area: string
  distance_miles?: number
  beds?: number
  baths?: number
  sqft?: number
  sqft_variance?: number // percentage, default 10%
  limit?: number
}

/**
 * Comparable Sales Analysis
 */
export interface ComparableSalesAnalysis {
  property_address: string
  comparables: ComparableSale[]
  statistics: {
    median_price: number
    average_price: number
    price_range: { min: number; max: number }
    average_days_on_market?: number
    median_price_per_sqft?: number
  }
}

// ============================================================================
// Market Data Types
// ============================================================================

/**
 * Market metrics data
 */
export interface MarketMetrics {
  avg_days_on_market?: number
  median_price?: number
  price_per_sqft?: number
  inventory_count?: number
  price_trend?: 'up' | 'down' | 'stable'
  sales_count?: number
  new_listings?: number
  [key: string]: any
}

/**
 * Market Data Snapshot
 */
export interface MarketDataSnapshot {
  id: string
  market_area: string
  snapshot_date: string
  market_metrics: MarketMetrics
  created_at: string
}

/**
 * Market Analysis Response
 */
export interface MarketAnalysis {
  market_area: string
  current_metrics: MarketMetrics
  historical_metrics?: MarketMetrics[]
  comparables?: ComparableSale[]
  trends?: {
    price_trend_12m: number // percentage
    days_on_market_trend: number
    inventory_trend: number
  }
  forecast?: {
    direction: 'up' | 'down' | 'stable'
    confidence: number
  }
}

// ============================================================================
// Integration Log Types
// ============================================================================

export type IntegrationStatus = 'success' | 'failed' | 'retry' | 'partial'

/**
 * Integration Log Entry
 */
export interface IntegrationLog {
  id: string
  service_type: ServiceType
  action: string
  status: IntegrationStatus
  request?: Record<string, any>
  response?: Record<string, any>
  error_message?: string
  retry_count: number
  next_retry_at?: string
  transaction_id?: string
  service_account_id?: string
  created_at: string
}

/**
 * Integration Status Summary
 */
export interface IntegrationStatus_ {
  mls_sync: {
    status: 'active' | 'inactive' | 'error'
    last_sync: string
    listings_count: number
    error?: string
  }
  services: {
    [key in ServiceType]?: {
      active_accounts: number
      status: 'ok' | 'warning' | 'error'
      error?: string
    }
  }
  recent_errors: IntegrationLog[]
}

// ============================================================================
// Property Valuation API Types
// ============================================================================

/**
 * Property Valuation from External Source
 */
export interface ExternalPropertyValuation {
  address: string
  valuation_type: ValuationType
  value_amount: number
  source: string
  valuation_date: string
  confidence_score?: number
}

/**
 * Multi-source Property Valuation
 */
export interface PropertyValuationMultiSource {
  address: string
  valuations: ExternalPropertyValuation[]
  consensus_value?: number
  value_discrepancy_alert?: boolean
  discrepancy_details?: string
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API Success Response
 */
export interface ApiSuccessResponse<T> {
  data: T
  message?: string
  timestamp: string
}

/**
 * Standard API Error Response
 */
export interface ApiErrorResponse {
  error: string
  code?: string
  details?: Record<string, any>
  timestamp: string
}

/**
 * Paginated API Response
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  timestamp: string
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Service Status Update Webhook
 */
export interface ServiceStatusWebhook {
  event_type: 'status_update' | 'document_ready' | 'error' | 'completed'
  service_type: ServiceType
  external_id: string
  status: RequestStatus
  data?: Record<string, any>
  timestamp: string
}

/**
 * MLS Sync Webhook
 */
export interface MLSSyncWebhook {
  event_type: 'new_listing' | 'price_change' | 'status_change' | 'sold'
  mls_number: string
  listing: Partial<MLSListing>
  timestamp: string
}
