/**
 * Vault API Client
 * Handles all communication between Agent Portal and Vault backend
 */

const VAULT_API_URL = process.env.NEXT_PUBLIC_VAULT_API_URL || 'https://hartfelt-vault.vercel.app/api'

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

    // Broker Review Workflow
    submitForReview: (transactionId: string, brokerAssignedId: string, slaHours: number = 48, userId: string, userRole?: string | null) =>
      vaultRequest(`/transactions/${transactionId}/submit-review`, {
        method: 'POST',
        body: { broker_assigned_id: brokerAssignedId, sla_hours: slaHours },
        userId,
        userRole,
      }),

    approveReview: (transactionId: string, approvalNotes?: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/transactions/${transactionId}/approve-review`, {
        method: 'PUT',
        body: { approval_notes: approvalNotes },
        userId,
        userRole,
      }),

    requestRevisions: (transactionId: string, revisionNotes: string, revisionDeadlineDays?: number, userId?: string, userRole?: string | null) =>
      vaultRequest(`/transactions/${transactionId}/request-revisions`, {
        method: 'PUT',
        body: { revision_notes: revisionNotes, revision_deadline_days: revisionDeadlineDays },
        userId,
        userRole,
      }),
  },

  // ============ TASKS ============
  tasks: {
    list: (transactionId?: string, status?: string, priority?: string, userId?: string, userRole?: string | null) => {
      let endpoint = '/tasks';
      const params = new URLSearchParams();
      if (transactionId) params.append('transactionId', transactionId);
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (params.toString()) endpoint += `?${params.toString()}`;

      return vaultRequest(endpoint, { userId, userRole });
    },

    get: (taskId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/tasks/${taskId}`, { userId, userRole }),

    create: (data: {
      transaction_id: string;
      task_template_id?: string;
      title: string;
      description?: string;
      assigned_to_id: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      due_date?: string;
    }, userId?: string, userRole?: string | null) =>
      vaultRequest('/tasks', {
        method: 'POST',
        body: data,
        userId,
        userRole,
      }),

    update: (taskId: string, updates: {
      title?: string;
      description?: string;
      status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
      priority?: 'low' | 'medium' | 'high' | 'critical';
      due_date?: string;
      assigned_to_id?: string;
      notes?: string;
    }, userId?: string, userRole?: string | null) =>
      vaultRequest(`/tasks/${taskId}`, {
        method: 'PUT',
        body: updates,
        userId,
        userRole,
      }),

    delete: (taskId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/tasks/${taskId}`, {
        method: 'DELETE',
        userId,
        userRole,
      }),

    // Checklist items
    getChecklist: (taskId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/tasks/${taskId}/checklist`, { userId, userRole }),

    addChecklistItem: (taskId: string, title: string, order_index?: number, userId?: string, userRole?: string | null) =>
      vaultRequest(`/tasks/${taskId}/checklist`, {
        method: 'POST',
        body: { title, order_index },
        userId,
        userRole,
      }),

    updateChecklistItem: (itemId: string, updates: {
      is_completed?: boolean;
      title?: string;
    }, userId?: string, userRole?: string | null) =>
      vaultRequest(`/checklist-items/${itemId}`, {
        method: 'PUT',
        body: updates,
        userId,
        userRole,
      }),

    deleteChecklistItem: (itemId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/checklist-items/${itemId}`, {
        method: 'DELETE',
        userId,
        userRole,
      }),

    // Comments
    getComments: (taskId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/tasks/${taskId}/comments`, { userId, userRole }),

    addComment: (taskId: string, content: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: { content },
        userId,
        userRole,
      }),

    // Activity log
    getActivity: (taskId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/tasks/${taskId}/activity`, { userId, userRole }),
  },

  // ============ TASK TEMPLATES ============
  taskTemplates: {
    list: (dealType?: string, userId?: string, userRole?: string | null) => {
      let endpoint = '/task-templates';
      if (dealType) endpoint += `?dealType=${dealType}`;
      return vaultRequest(endpoint, { userId, userRole });
    },

    get: (templateId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/task-templates/${templateId}`, { userId, userRole }),

    create: (data: {
      name: string;
      description?: string;
      deal_type: string;
      template_items?: Array<{
        title: string;
        description?: string;
        order_index?: number;
        estimated_hours?: number;
      }>;
    }, userId?: string, userRole?: string | null) =>
      vaultRequest('/task-templates', {
        method: 'POST',
        body: data,
        userId,
        userRole,
      }),

    update: (templateId: string, data: {
      name?: string;
      description?: string;
      deal_type?: string;
      template_items?: Array<{
        title: string;
        description?: string;
        order_index?: number;
        estimated_hours?: number;
      }>;
    }, userId?: string, userRole?: string | null) =>
      vaultRequest(`/task-templates/${templateId}`, {
        method: 'PUT',
        body: data,
        userId,
        userRole,
      }),

    delete: (templateId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/task-templates/${templateId}`, {
        method: 'DELETE',
        userId,
        userRole,
      }),
  },

  // ============ BROKER TASK DASHBOARD ============
  brokerDashboard: {
    getTaskMetrics: (userId?: string, userRole?: string | null) =>
      vaultRequest('/broker/task-dashboard', { userId, userRole }),
  },

  // ============ SMART DEADLINES / TIMELINE ============
  timeline: {
    // Extract dates from contract document
    extractDates: (transactionId: string, documentId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/transactions/${transactionId}/extract-dates`, {
        method: 'POST',
        body: { document_id: documentId },
        userId,
        userRole,
      }),

    // Get deal timeline with all dates and generated tasks
    getTimeline: (transactionId: string, userId?: string, userRole?: string | null) =>
      vaultRequest(`/transactions/${transactionId}/timeline`, { userId, userRole }),

    // Generate intermediate deadlines from closing date
    generateTimeline: (
      transactionId: string,
      closingDate: string,
      dealType?: string,
      customLeadTimes?: Record<string, number>,
      userId?: string,
      userRole?: string | null
    ) =>
      vaultRequest(`/transactions/${transactionId}/generate-timeline`, {
        method: 'POST',
        body: {
          closing_date: closingDate,
          deal_type: dealType,
          custom_lead_times: customLeadTimes,
        },
        userId,
        userRole,
      }),

    // Get all broker warnings
    getWarnings: (resolved?: boolean, severity?: string, warningType?: string, userId?: string, userRole?: string | null) => {
      let endpoint = '/broker/warnings';
      const params = new URLSearchParams();
      if (resolved !== undefined) params.append('resolved', resolved ? 'true' : 'false');
      if (severity) params.append('severity', severity);
      if (warningType) params.append('type', warningType);
      if (params.toString()) endpoint += `?${params.toString()}`;

      return vaultRequest(endpoint, { userId, userRole });
    },

    // Resolve warnings
    resolveWarnings: (warningIds: string[], resolutionNotes?: string, userId?: string, userRole?: string | null) =>
      vaultRequest('/broker/warnings', {
        method: 'PUT',
        body: {
          warning_ids: warningIds,
          action: 'resolve',
          resolution_notes: resolutionNotes,
        },
        userId,
        userRole,
      }),

    // Dismiss warnings
    dismissWarnings: (warningIds: string[], userId?: string, userRole?: string | null) =>
      vaultRequest('/broker/warnings', {
        method: 'PUT',
        body: {
          warning_ids: warningIds,
          action: 'dismiss',
        },
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
