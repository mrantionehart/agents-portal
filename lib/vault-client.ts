/**
 * Vault API Client
 * Handles all communication between Agent Portal and Vault backend
 */

const VAULT_API_URL = process.env.NEXT_PUBLIC_VAULT_API_URL || 'http://localhost:3000'

interface VaultRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  userId?: string
  userRole?: string | null
}

/**
 * Make authenticated request to Vault API
 */
async function vaultRequest(
  endpoint: string,
  options: VaultRequestOptions = {}
): Promise<any> {
  const {
    method = 'GET',
    body,
    headers = {},
    userId,
    userRole,
  } = options

  const url = `${VAULT_API_URL}${endpoint}`

  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (userId) {
    requestOptions.headers = {
      ...requestOptions.headers,
      'X-User-ID': userId,
    }
  }

  if (userRole) {
    requestOptions.headers = {
      ...requestOptions.headers,
      'X-User-Role': userRole,
    }
  }

  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, requestOptions)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `API Error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Vault API Error [${endpoint}]:`, error)
    // Return empty data on network errors instead of throwing
    // This allows pages to load without crashing
    return { data: [], deals: [], commissions: [], leads: [], documents: [] }
  }
}

/**
 * Vault API Client Methods
 */
export const vaultAPI = {
  // ============ DOCUMENTS ============
  documents: {
    list: (userId: string, userRole?: string | null) =>
      vaultRequest('/documents', { userId, userRole }),

    upload: (file: File, dealId: string, userId: string, stage?: string, userRole?: string | null) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('dealId', dealId)
      if (stage) {
        formData.append('stage', stage)
      }

      return fetch(`${VAULT_API_URL}/documents`, {
        method: 'POST',
        body: formData,
        headers: {
          'X-User-ID': userId,
          ...(userRole && { 'X-User-Role': userRole }),
        },
      }).then(r => r.json())
    },
  },

  // ============ COMMISSIONS ============
  commissions: {
    list: (userId: string, userRole?: string | null) =>
      vaultRequest('/commissions/get', { userId, userRole }),

    calculate: (params: {
      salePrice: number
      commissionRate: number
      brokerSplit: number
      referralFee?: number
      transactionFee?: number
    }, userId: string, userRole?: string | null) =>
      vaultRequest('/commissions/calculate', {
        method: 'POST',
        body: params,
        userId,
        userRole,
      }),

    approve: (commissionId: string, userId: string, userRole?: string | null) =>
      vaultRequest('/commissions/approve', {
        method: 'POST',
        body: { commissionId },
        userId,
        userRole,
      }),
  },

  // ============ AI / COMPLIANCE ============
  ai: {
    analyzeDocument: (document: File, userId: string, userRole?: string | null) => {
      const formData = new FormData()
      formData.append('file', document)

      return fetch(`${VAULT_API_URL}/ai/analyze-document`, {
        method: 'POST',
        body: formData,
        headers: {
          'X-User-ID': userId,
          ...(userRole && { 'X-User-Role': userRole }),
        },
      }).then(r => r.json())
    },

    complianceCheck: (data: any, userId: string, userRole?: string | null) =>
      vaultRequest('/ai/compliance-check', {
        method: 'POST',
        body: data,
        userId,
        userRole,
      }),

    extractDeadlines: (document: File, userId: string, userRole?: string | null) => {
      const formData = new FormData()
      formData.append('file', document)

      return fetch(`${VAULT_API_URL}/ai/extract-deadlines`, {
        method: 'POST',
        body: formData,
        headers: {
          'X-User-ID': userId,
          ...(userRole && { 'X-User-Role': userRole }),
        },
      }).then(r => r.json())
    },

    chat: (message: string, userId: string, userRole?: string | null) =>
      vaultRequest('/ai/chat', {
        method: 'POST',
        body: { message },
        userId,
        userRole,
      }),
  },

  // ============ TRANSACTIONS ============
  transactions: {
    list: (userId: string, userRole?: string | null) =>
      vaultRequest('/transactions', { userId, userRole }),

    update: (transactionId: string, updates: any, userId: string, userRole?: string | null) =>
      vaultRequest(`/transactions/update`, {
        method: 'POST',
        body: { transactionId, ...updates },
        userId,
        userRole,
      }),

    close: (transactionId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/transactions/close`, {
        method: 'POST',
        body: { transactionId },
        userId,
        userRole,
      }),
  },

  // ============ LEADS ============
  leads: {
    list: (userId: string, userRole?: string | null) =>
      vaultRequest('/leads', { userId, userRole }),

    create: (leadData: any, userId: string, userRole?: string | null) =>
      vaultRequest('/leads', { method: 'POST', body: leadData, userId, userRole }),

    get: (leadId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/leads/${leadId}`, { userId, userRole }),

    update: (leadId: string, updates: any, userId: string, userRole?: string | null) =>
      vaultRequest(`/leads/${leadId}`, { method: 'PUT', body: updates, userId, userRole }),

    delete: (leadId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/leads/${leadId}`, { method: 'DELETE', userId, userRole }),

    getActivities: (leadId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/leads/${leadId}/activities`, { userId, userRole }),

    addActivity: (leadId: string, activity: any, userId: string, userRole?: string | null) =>
      vaultRequest(`/leads/${leadId}/activities`, { method: 'POST', body: activity, userId, userRole }),
  },

  // ============ DEALS / PIPELINE ============
  deals: {
    list: (userId: string, userRole?: string | null) =>
      vaultRequest('/deals', { userId, userRole }),

    create: (dealData: any, userId: string, userRole?: string | null) =>
      vaultRequest('/deals', { method: 'POST', body: dealData, userId, userRole }),

    get: (dealId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/deals/${dealId}`, { userId, userRole }),

    update: (dealId: string, updates: any, userId: string, userRole?: string | null) =>
      vaultRequest(`/deals/${dealId}`, { method: 'PUT', body: updates, userId, userRole }),

    updateStage: (dealId: string, stage: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/deals/${dealId}`, { method: 'PUT', body: { stage }, userId, userRole }),

    delete: (dealId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/deals/${dealId}`, { method: 'DELETE', userId, userRole }),
  },

  // ============ EMAIL TEMPLATES ============
  emailTemplates: {
    list: (userId: string, userRole?: string | null) =>
      vaultRequest('/email-templates', { userId, userRole }),

    create: (templateData: any, userId: string, userRole?: string | null) =>
      vaultRequest('/email-templates', { method: 'POST', body: templateData, userId, userRole }),

    update: (templateId: string, updates: any, userId: string, userRole?: string | null) =>
      vaultRequest(`/email-templates/${templateId}`, { method: 'PUT', body: updates, userId, userRole }),

    delete: (templateId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/email-templates/${templateId}`, { method: 'DELETE', userId, userRole }),

    send: (recipientEmail: string, templateId: string, variables: any, userId: string, userRole?: string | null) =>
      vaultRequest('/email/send', {
        method: 'POST',
        body: { recipientEmail, templateId, variables },
        userId,
        userRole
      }),
  },

  // ============ ONBOARDING ============
  onboarding: {
    // Get all onboarding records (admin only)
    list: (userId: string, userRole?: string | null) =>
      vaultRequest('/onboarding/list', { userId, userRole }),

    // Get a specific onboarding record
    get: (inviteId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/onboarding/${inviteId}`, { userId, userRole }),

    // Create new onboarding invite
    createInvite: (data: {
      firstName: string
      lastName: string
      email: string
      documentIds: string[]
    }, userId: string, userRole?: string | null) =>
      vaultRequest('/onboarding/invite', {
        method: 'POST',
        body: data,
        userId,
        userRole,
      }),

    // Approve onboarding (after documents signed)
    approve: (inviteId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/onboarding/${inviteId}/approve`, {
        method: 'POST',
        body: { inviteId },
        userId,
        userRole,
      }),

    // Provision agent account (create email + Portal user)
    provision: (inviteId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/onboarding/${inviteId}/provision`, {
        method: 'POST',
        body: { inviteId },
        userId,
        userRole,
      }),

    // Upload document template
    uploadDocument: (file: File, documentName: string, userId: string, userRole?: string | null) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentName', documentName)

      return fetch(`${VAULT_API_URL}/onboarding/documents`, {
        method: 'POST',
        body: formData,
        headers: {
          'X-User-ID': userId,
          ...(userRole && { 'X-User-Role': userRole }),
        },
      }).then(r => r.json())
    },

    // Get DocuSign signing link
    getSigningLink: (inviteId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/onboarding/${inviteId}/signing-link`, { userId, userRole }),

    // Send signing reminder
    sendReminder: (inviteId: string, userId: string, userRole?: string | null) =>
      vaultRequest(`/onboarding/${inviteId}/send-reminder`, {
        method: 'POST',
        userId,
        userRole,
      }),
  },

  // ============ TRAINING / RESOURCES ============
  resources: {
    // These will come from EASE app data
    getTrainingModules: async () => {
      // TODO: Connect to EASE API or fetch from shared database
      return {
        modules: [
          // Training data will be populated from EASE
        ],
      }
    },
  },
}

export default vaultAPI
