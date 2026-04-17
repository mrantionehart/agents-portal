// VaultDashboardTCClient
// Purpose: TypeScript client library for Transaction Coordinator System
// Features: Type-safe API wrapper with full CRUD operations for TC workflows

import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Transaction Coordinator Data Structures
 */
export interface TCCoordinator {
  id: string
  agent_id: string
  tc_user_id: string
  status: 'active' | 'inactive' | 'pending_approval'
  commission_split: number
  hire_date: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface TCAssignment {
  id: string
  agent_id: string
  tc_id: string
  status: 'pending_approval' | 'approved' | 'active' | 'inactive'
  commission_split: number
  created_at: string
  updated_at: string
}

export interface TCTransaction {
  id: string
  agent_id: string
  tc_id: string
  title: string
  type: 'new_deal' | 'follow_up' | 'closing' | 'other'
  status: 'created' | 'in_progress' | 'pending_docs' | 'completed' | 'stalled'
  expected_close_date?: string
  notes?: string
  assigned_by: string
  created_at: string
  updated_at: string
}

export interface TCDocument {
  id: string
  transaction_id: string
  doc_type: 'contract' | 'disclosure' | 'inspection' | 'appraisal' | 'insurance' | 'title' | 'other'
  file_url: string
  file_name: string
  status: 'pending' | 'received' | 'verified' | 'failed'
  notes?: string
  uploaded_by: string
  uploaded_at: string
  created_at: string
  updated_at: string
}

export interface TCMilestone {
  id: string
  transaction_id: string
  milestone_name: string
  due_date: string
  status: 'pending' | 'completed' | 'overdue' | 'skipped'
  created_by: string
  created_at: string
  updated_at: string
  completed_date?: string
}

export interface TCNotification {
  id: string
  type: 'doc_verified' | 'transaction_created' | 'milestone_overdue' | 'milestone_completed' | 'assignment_approved'
  message: string
  transaction_id?: string
  recipient_id: string
  read: boolean
  created_at: string
}

export interface CreateTCRequest {
  agent_id: string
  tc_user_id: string
  commission_split: number
  metadata?: Record<string, any>
}

export interface UpdateTCRequest {
  status?: 'active' | 'inactive' | 'pending_approval'
  commission_split?: number
  metadata?: Record<string, any>
}

export interface CreateAssignmentRequest {
  agent_id: string
  tc_id: string
  commission_split: number
}

export interface CreateTransactionRequest {
  agent_id: string
  tc_id: string
  title: string
  type: 'new_deal' | 'follow_up' | 'closing' | 'other'
  expected_close_date?: string
  notes?: string
}

export interface UpdateTransactionRequest {
  title?: string
  status?: 'created' | 'in_progress' | 'pending_docs' | 'completed' | 'stalled'
  expected_close_date?: string
  notes?: string
}

export interface UploadDocumentRequest {
  transaction_id: string
  doc_type: 'contract' | 'disclosure' | 'inspection' | 'appraisal' | 'insurance' | 'title' | 'other'
  file_url: string
  file_name: string
  notes?: string
}

export interface CreateMilestoneRequest {
  transaction_id: string
  milestone_name: string
  due_date: string
}

export interface APIResponse<T> {
  data?: T
  error?: string
  status: number
}

export interface ListOptions {
  limit?: number
  offset?: number
  status?: string
  agent_id?: string
  tc_id?: string
}

/**
 * VaultDashboardTCClient
 * Main client class for Transaction Coordinator operations
 */
export class VaultDashboardTCClient {
  private supabase: SupabaseClient
  private userId: string | null
  private userRole: string | null
  private apiBaseUrl: string

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    apiBaseUrl: string = '/api',
    userId?: string | null,
    userRole?: string | null
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
    this.apiBaseUrl = apiBaseUrl
    this.userId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null)
    this.userRole = userRole || (typeof window !== 'undefined' ? localStorage.getItem('userRole') : null)
  }

  /**
   * Set authentication context
   */
  setAuth(userId: string, userRole: string): void {
    this.userId = userId
    this.userRole = userRole
  }

  /**
   * Helper method to make API requests with auth headers
   */
  private async apiRequest<T>(
    method: string,
    path: string,
    data?: any
  ): Promise<APIResponse<T>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-User-ID': this.userId || '',
        'X-User-Role': this.userRole || '',
      }

      const options: RequestInit = {
        method,
        headers,
      }

      if (data) {
        options.body = JSON.stringify(data)
      }

      const response = await fetch(`${this.apiBaseUrl}${path}`, options)
      const responseData = await response.json()

      return {
        data: responseData.data || responseData,
        error: responseData.error,
        status: response.status,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500,
      }
    }
  }

  /**
   * TRANSACTION COORDINATORS
   */

  async createTC(request: CreateTCRequest): Promise<APIResponse<TCCoordinator>> {
    return this.apiRequest<TCCoordinator>('POST', '/broker/tc/coordinators', request)
  }

  async listTCs(options?: ListOptions): Promise<APIResponse<TCCoordinator[]>> {
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.offset) params.append('offset', String(options.offset))
    if (options?.status) params.append('status', options.status)

    return this.apiRequest<TCCoordinator[]>(
      'GET',
      `/broker/tc/coordinators?${params.toString()}`,
      undefined
    )
  }

  async getTC(tcId: string): Promise<APIResponse<TCCoordinator>> {
    return this.apiRequest<TCCoordinator>('GET', `/broker/tc/coordinators/${tcId}`, undefined)
  }

  async updateTC(tcId: string, request: UpdateTCRequest): Promise<APIResponse<TCCoordinator>> {
    return this.apiRequest<TCCoordinator>('PATCH', `/broker/tc/coordinators/${tcId}`, request)
  }

  async deactivateTC(tcId: string): Promise<APIResponse<TCCoordinator>> {
    return this.apiRequest<TCCoordinator>('DELETE', `/broker/tc/coordinators/${tcId}`, undefined)
  }

  /**
   * TC ASSIGNMENTS
   */

  async requestTCAssignment(request: CreateAssignmentRequest): Promise<APIResponse<TCAssignment>> {
    return this.apiRequest<TCAssignment>('POST', '/broker/tc/assignments', request)
  }

  async listAssignments(options?: ListOptions): Promise<APIResponse<TCAssignment[]>> {
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.offset) params.append('offset', String(options.offset))
    if (options?.status) params.append('status', options.status)
    if (options?.agent_id) params.append('agent_id', options.agent_id)
    if (options?.tc_id) params.append('tc_id', options.tc_id)

    return this.apiRequest<TCAssignment[]>(
      'GET',
      `/broker/tc/assignments?${params.toString()}`,
      undefined
    )
  }

  async getAssignment(assignmentId: string): Promise<APIResponse<TCAssignment>> {
    return this.apiRequest<TCAssignment>('GET', `/broker/tc/assignments/${assignmentId}`, undefined)
  }

  async approveTCAssignment(assignmentId: string): Promise<APIResponse<TCAssignment>> {
    return this.apiRequest<TCAssignment>(
      'PATCH',
      `/broker/tc/assignments/${assignmentId}?action=approve`,
      {}
    )
  }

  async denyTCAssignment(assignmentId: string): Promise<APIResponse<TCAssignment>> {
    return this.apiRequest<TCAssignment>(
      'PATCH',
      `/broker/tc/assignments/${assignmentId}?action=deny`,
      {}
    )
  }

  async updateAssignment(
    assignmentId: string,
    request: Partial<CreateAssignmentRequest>
  ): Promise<APIResponse<TCAssignment>> {
    return this.apiRequest<TCAssignment>(
      'PATCH',
      `/broker/tc/assignments/${assignmentId}`,
      request
    )
  }

  async deactivateAssignment(assignmentId: string): Promise<APIResponse<TCAssignment>> {
    return this.apiRequest<TCAssignment>('DELETE', `/broker/tc/assignments/${assignmentId}`, undefined)
  }

  /**
   * TC TRANSACTIONS
   */

  async createTransaction(
    request: CreateTransactionRequest
  ): Promise<APIResponse<TCTransaction>> {
    return this.apiRequest<TCTransaction>('POST', '/broker/tc/transactions', request)
  }

  async listTransactions(options?: ListOptions): Promise<APIResponse<TCTransaction[]>> {
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.offset) params.append('offset', String(options.offset))
    if (options?.status) params.append('status', options.status)
    if (options?.agent_id) params.append('agent_id', options.agent_id)
    if (options?.tc_id) params.append('tc_id', options.tc_id)

    return this.apiRequest<TCTransaction[]>(
      'GET',
      `/broker/tc/transactions?${params.toString()}`,
      undefined
    )
  }

  async getTransaction(transactionId: string): Promise<APIResponse<TCTransaction>> {
    return this.apiRequest<TCTransaction>('GET', `/broker/tc/transactions/${transactionId}`, undefined)
  }

  async updateTransaction(
    transactionId: string,
    request: UpdateTransactionRequest
  ): Promise<APIResponse<TCTransaction>> {
    return this.apiRequest<TCTransaction>('PATCH', `/broker/tc/transactions/${transactionId}`, request)
  }

  async deleteTransaction(transactionId: string): Promise<APIResponse<TCTransaction>> {
    return this.apiRequest<TCTransaction>('DELETE', `/broker/tc/transactions/${transactionId}`, undefined)
  }

  /**
   * TC DOCUMENTS
   */

  async uploadDocument(request: UploadDocumentRequest): Promise<APIResponse<TCDocument>> {
    return this.apiRequest<TCDocument>('POST', '/broker/tc/documents', request)
  }

  async listDocuments(transactionId?: string): Promise<APIResponse<TCDocument[]>> {
    const path = transactionId
      ? `/broker/tc/documents?transaction_id=${transactionId}`
      : '/broker/tc/documents'

    return this.apiRequest<TCDocument[]>('GET', path, undefined)
  }

  async getDocument(documentId: string): Promise<APIResponse<TCDocument>> {
    return this.apiRequest<TCDocument>('GET', `/broker/tc/documents/${documentId}`, undefined)
  }

  async updateDocumentStatus(
    documentId: string,
    status: 'pending' | 'received' | 'verified' | 'failed'
  ): Promise<APIResponse<TCDocument>> {
    return this.apiRequest<TCDocument>('PATCH', `/broker/tc/documents/${documentId}`, {
      status,
    })
  }

  async deleteDocument(documentId: string): Promise<APIResponse<TCDocument>> {
    return this.apiRequest<TCDocument>('DELETE', `/broker/tc/documents/${documentId}`, undefined)
  }

  /**
   * TC MILESTONES
   */

  async createMilestone(request: CreateMilestoneRequest): Promise<APIResponse<TCMilestone>> {
    return this.apiRequest<TCMilestone>('POST', '/broker/tc/milestones', request)
  }

  async listMilestones(transactionId?: string): Promise<APIResponse<TCMilestone[]>> {
    const path = transactionId
      ? `/broker/tc/milestones?transaction_id=${transactionId}`
      : '/broker/tc/milestones'

    return this.apiRequest<TCMilestone[]>('GET', path, undefined)
  }

  async getMilestone(milestoneId: string): Promise<APIResponse<TCMilestone>> {
    return this.apiRequest<TCMilestone>('GET', `/broker/tc/milestones/${milestoneId}`, undefined)
  }

  async updateMilestoneStatus(
    milestoneId: string,
    status: 'pending' | 'completed' | 'overdue' | 'skipped'
  ): Promise<APIResponse<TCMilestone>> {
    return this.apiRequest<TCMilestone>('PATCH', `/broker/tc/milestones/${milestoneId}`, {
      status,
    })
  }

  async deleteMilestone(milestoneId: string): Promise<APIResponse<TCMilestone>> {
    return this.apiRequest<TCMilestone>('DELETE', `/broker/tc/milestones/${milestoneId}`, undefined)
  }

  /**
   * NOTIFICATIONS
   */

  async listNotifications(userId: string): Promise<APIResponse<TCNotification[]>> {
    return this.apiRequest<TCNotification[]>(
      'GET',
      `/broker/tc/notifications?user_id=${userId}`,
      undefined
    )
  }

  async markNotificationRead(notificationId: string): Promise<APIResponse<TCNotification>> {
    return this.apiRequest<TCNotification>('PATCH', `/broker/tc/notifications/${notificationId}`, {
      read: true,
    })
  }

  /**
   * REAL-TIME SUBSCRIPTIONS
   */

  subscribeToAssignments(callback: (assignment: TCAssignment) => void): void {
    this.supabase
      .channel('tc_assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tc_assignments' }, (payload) => {
        callback(payload.new as TCAssignment)
      })
      .subscribe()
  }

  subscribeToTransactions(callback: (transaction: TCTransaction) => void): void {
    this.supabase
      .channel('tc_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tc_transactions' }, (payload) => {
        callback(payload.new as TCTransaction)
      })
      .subscribe()
  }

  subscribeToDocuments(callback: (document: TCDocument) => void): void {
    this.supabase
      .channel('tc_documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tc_documents' }, (payload) => {
        callback(payload.new as TCDocument)
      })
      .subscribe()
  }

  subscribeToMilestones(callback: (milestone: TCMilestone) => void): void {
    this.supabase
      .channel('tc_milestones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tc_milestones' }, (payload) => {
        callback(payload.new as TCMilestone)
      })
      .subscribe()
  }

  /**
   * HELPER METHODS
   */

  async getFullWorkloadSummary(tcId: string): Promise<{
    coordinator?: TCCoordinator
    assignmentCount: number
    transactionCount: number
    documentCount: number
    milestoneCount: number
    overdueMilestoneCount: number
  }> {
    try {
      const assignments = await this.listAssignments({ tc_id: tcId })
      const transactions = await this.listTransactions({ tc_id: tcId })
      const documents = await this.listDocuments()
      const milestones = await this.listMilestones()

      const assignmentCount = assignments.data?.length || 0
      const transactionCount = transactions.data?.length || 0
      const documentCount = documents.data?.length || 0
      const milestoneCount = milestones.data?.length || 0
      const overdueMilestoneCount =
        milestones.data?.filter((m) => m.status === 'overdue').length || 0

      return {
        assignmentCount,
        transactionCount,
        documentCount,
        milestoneCount,
        overdueMilestoneCount,
      }
    } catch (error) {
      console.error('Error getting workload summary:', error)
      return {
        assignmentCount: 0,
        transactionCount: 0,
        documentCount: 0,
        milestoneCount: 0,
        overdueMilestoneCount: 0,
      }
    }
  }

  async getTransactionDocumentStatus(transactionId: string): Promise<{
    total: number
    verified: number
    pending: number
    failed: number
    completion: number
  }> {
    try {
      const documents = await this.listDocuments(transactionId)
      const docs = documents.data || []

      const total = docs.length
      const verified = docs.filter((d) => d.status === 'verified').length
      const pending = docs.filter((d) => d.status === 'pending').length
      const failed = docs.filter((d) => d.status === 'failed').length
      const completion = total > 0 ? Math.round((verified / total) * 100) : 0

      return {
        total,
        verified,
        pending,
        failed,
        completion,
      }
    } catch (error) {
      console.error('Error getting document status:', error)
      return {
        total: 0,
        verified: 0,
        pending: 0,
        failed: 0,
        completion: 0,
      }
    }
  }

  async getPendingApprovals(): Promise<TCAssignment[]> {
    try {
      const response = await this.listAssignments({ status: 'pending_approval' })
      return response.data || []
    } catch (error) {
      console.error('Error getting pending approvals:', error)
      return []
    }
  }

  async getStalledTransactions(): Promise<TCTransaction[]> {
    try {
      const response = await this.listTransactions({ status: 'stalled' })
      return response.data || []
    } catch (error) {
      console.error('Error getting stalled transactions:', error)
      return []
    }
  }

  async getOverdueMilestones(): Promise<TCMilestone[]> {
    try {
      const response = await this.listMilestones()
      const milestones = response.data || []
      return milestones.filter((m) => m.status === 'overdue')
    } catch (error) {
      console.error('Error getting overdue milestones:', error)
      return []
    }
  }
}

// Export singleton instance for convenience
let _instance: VaultDashboardTCClient | null = null

export function getVaultDashboardTCClient(
  supabaseUrl?: string,
  supabaseKey?: string,
  apiBaseUrl?: string
): VaultDashboardTCClient {
  if (!_instance) {
    _instance = new VaultDashboardTCClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      apiBaseUrl || '/api'
    )
  }
  return _instance
}

export default VaultDashboardTCClient
