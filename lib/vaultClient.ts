/**
 * Vault API Client
 * Provides methods to interact with hartfelt-vault API endpoints
 */

const VAULT_BASE_URL =
  process.env.NEXT_PUBLIC_VAULT_API_URL ||
  process.env.NEXT_PUBLIC_VAULT_URL ||
  'https://vault.hartfeltrealestate.com/api'

interface ApiResponse<T> {
  success: boolean
  error?: string
  data?: T
  [key: string]: any
}

class VaultClient {
  private baseUrl: string

  constructor(baseUrl: string = VAULT_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * Generic fetch wrapper for API calls
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Ensure endpoint starts with /
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
      const url = `${this.baseUrl}${normalizedEndpoint}`

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        ...data,
      }
    } catch (error) {
      console.error(`Vault API Error on ${endpoint}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * GET /notifications/push
   * Fetch push notifications for a user
   */
  async getPushNotifications(userId: string, limit: number = 50) {
    return this.fetch(`/notifications/push?user_id=${userId}&limit=${limit}`, {
      method: 'GET',
    })
  }

  /**
   * POST /notifications/push
   * Send a push notification to a user
   */
  async sendPushNotification(payload: {
    user_id: string
    title: string
    body: string
    data?: Record<string, any>
  }) {
    return this.fetch('/notifications/push', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  /**
   * GET /reports/agent-performance
   * Fetch agent performance reports
   */
  async getAgentPerformanceReports(params?: {
    period?: string
    agent_id?: string
    limit?: number
  }) {
    const query = new URLSearchParams()
    if (params?.period) query.append('period', params.period)
    if (params?.agent_id) query.append('agent_id', params.agent_id)
    if (params?.limit) query.append('limit', params.limit.toString())

    return this.fetch(
      `/reports/agent-performance${query.toString() ? `?${query.toString()}` : ''}`,
      { method: 'GET' }
    )
  }

  /**
   * GET /compliance/alerts
   * Fetch compliance alerts
   */
  async getComplianceAlerts(params?: {
    severity?: 'warning' | 'error' | 'critical'
    resolved?: boolean
    limit?: number
  }) {
    const query = new URLSearchParams()
    if (params?.severity) query.append('severity', params.severity)
    if (params?.resolved !== undefined) query.append('resolved', params.resolved.toString())
    if (params?.limit) query.append('limit', params.limit.toString())

    return this.fetch(
      `/compliance/alerts${query.toString() ? `?${query.toString()}` : ''}`,
      { method: 'GET' }
    )
  }

  /**
   * GET /compliance/status
   * Fetch overall compliance status
   */
  async getComplianceStatus() {
    return this.fetch('/compliance/status', { method: 'GET' })
  }

  /**
   * POST /ai/compliance-check
   * Run AI compliance check on a transaction
   */
  async runComplianceCheck(params: {
    transaction_id: string
    trigger_type?: 'manual' | 'auto_upload' | 'scheduled'
  }) {
    return this.fetch('/ai/compliance-check', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * GET /deals
   * Fetch deals with optional filtering
   */
  async getDeals(params?: {
    agent_id?: string
    status?: string
    limit?: number
    offset?: number
  }) {
    const query = new URLSearchParams()
    if (params?.agent_id) query.append('agent_id', params.agent_id)
    if (params?.status) query.append('status', params.status)
    if (params?.limit) query.append('limit', params.limit.toString())
    if (params?.offset) query.append('offset', params.offset.toString())

    return this.fetch(
      `/deals${query.toString() ? `?${query.toString()}` : ''}`,
      { method: 'GET' }
    )
  }

  /**
   * GET /deals/:id
   * Fetch a specific deal
   */
  async getDeal(dealId: string) {
    return this.fetch(`/deals/${dealId}`, { method: 'GET' })
  }

  /**
   * POST /deals
   * Create a new deal
   */
  async createDeal(dealData: Record<string, any>) {
    return this.fetch('/deals', {
      method: 'POST',
      body: JSON.stringify(dealData),
    })
  }

  /**
   * PATCH /deals/:id
   * Update a deal
   */
  async updateDeal(dealId: string, updates: Record<string, any>) {
    return this.fetch(`/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  /**
   * GET /agents
   * Fetch agents with optional filtering
   */
  async getAgents(params?: {
    broker_id?: string
    status?: string
    limit?: number
  }) {
    const query = new URLSearchParams()
    if (params?.broker_id) query.append('broker_id', params.broker_id)
    if (params?.status) query.append('status', params.status)
    if (params?.limit) query.append('limit', params.limit.toString())

    return this.fetch(
      `/agents${query.toString() ? `?${query.toString()}` : ''}`,
      { method: 'GET' }
    )
  }

  /**
   * GET /agents/:id
   * Fetch a specific agent
   */
  async getAgent(agentId: string) {
    return this.fetch(`/agents/${agentId}`, { method: 'GET' })
  }

  /**
   * GET /commissions
   * Fetch commissions with optional filtering
   */
  async getCommissions(params?: {
    agent_id?: string
    deal_id?: string
    status?: string
    limit?: number
  }) {
    const query = new URLSearchParams()
    if (params?.agent_id) query.append('agent_id', params.agent_id)
    if (params?.deal_id) query.append('deal_id', params.deal_id)
    if (params?.status) query.append('status', params.status)
    if (params?.limit) query.append('limit', params.limit.toString())

    return this.fetch(
      `/commissions${query.toString() ? `?${query.toString()}` : ''}`,
      { method: 'GET' }
    )
  }

  /**
   * Health check endpoint
   */
  async healthCheck() {
    return this.fetch('/health', { method: 'GET' })
  }
}

// Export singleton instance
export const vaultClient = new VaultClient()

// Export class for testing/custom instances
export default VaultClient
