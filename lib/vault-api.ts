import axios, { AxiosInstance } from 'axios'
import { getAccessToken } from './supabase'
import { VAULT_API_URL } from './vault-client'

const vaultApiUrl = VAULT_API_URL

class VaultAPI {
  private client: AxiosInstance

  constructor(baseURL: string = vaultApiUrl) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // PORTAL.1A — attach the CACHED access token (never getSession(), which
    // hangs on the LockManager). Cold cache → brief onAuthStateChange wait.
    this.client.interceptors.request.use(async (config) => {
      try {
        const token = await getAccessToken(2000)
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch (error) {
        console.error('Error getting cached auth token:', error)
      }
      return config
    })
  }

  // P8-A — the Deals endpoints are gone.
  //
  // Vault retired POST/GET /api/deals and PUT/DELETE /api/deals/:id in P7.4C
  // (#1338), so `getDeals`, `createDeal`, `updateDeal` and `deleteDeal` called
  // routes that answer 404/405. `getDeal` and `deleteDeal` had exactly one
  // caller between them — the legacy `app/deals/[id]` page, deleted here — and
  // the other three had none at all.
  //
  // The rest of this client stays: PORTAL.1A guards its request interceptor
  // (cached token, never `getSession()`), and that hazard is a property of the
  // axios instance, not of the deal routes.

  // Commissions endpoints
  async getCommissions(filters?: Record<string, any>) {
    try {
      const { data } = await this.client.get('/commissions', { params: filters })
      return data
    } catch (error) {
      console.error('Error fetching commissions:', error)
      throw error
    }
  }

  async getCommission(commissionId: string) {
    try {
      const { data } = await this.client.get(`/commissions/${commissionId}`)
      return data
    } catch (error) {
      console.error('Error fetching commission:', error)
      throw error
    }
  }

  // Documents endpoints
  async getDocuments(filters?: Record<string, any>) {
    try {
      const { data } = await this.client.get('/documents', { params: filters })
      return data
    } catch (error) {
      console.error('Error fetching documents:', error)
      throw error
    }
  }

  async uploadDocument(file: File, metadata?: Record<string, any>) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata))
      }

      const { data } = await this.client.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return data
    } catch (error) {
      console.error('Error uploading document:', error)
      throw error
    }
  }

  async deleteDocument(documentId: string) {
    try {
      const { data } = await this.client.delete(`/documents/${documentId}`)
      return data
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }

  // Agents endpoints
  async getAgents(filters?: Record<string, any>) {
    try {
      const { data } = await this.client.get('/agents', { params: filters })
      return data
    } catch (error) {
      console.error('Error fetching agents:', error)
      throw error
    }
  }

  async getAgent(agentId: string) {
    try {
      const { data } = await this.client.get(`/agents/${agentId}`)
      return data
    } catch (error) {
      console.error('Error fetching agent:', error)
      throw error
    }
  }

  // Statistics endpoints
  async getAgentStats(agentId: string) {
    try {
      const { data } = await this.client.get(`/agents/${agentId}/stats`)
      return data
    } catch (error) {
      console.error('Error fetching agent stats:', error)
      throw error
    }
  }

  async getAllStats(filters?: Record<string, any>) {
    try {
      const { data } = await this.client.get('/stats', { params: filters })
      return data
    } catch (error) {
      console.error('Error fetching stats:', error)
      throw error
    }
  }

  // Compliance endpoints
  async runComplianceCheck(transactionId: string, triggerType: string = 'manual') {
    try {
      const { data } = await this.client.post('/transactions/compliance-check', {
        transaction_id: transactionId,
        trigger_type: triggerType,
      })
      return data
    } catch (error) {
      console.error('Error running compliance check:', error)
      throw error
    }
  }

  async getComplianceStatus(transactionId: string) {
    try {
      const { data } = await this.client.get('/compliance/status', {
        params: { transaction_id: transactionId },
      })
      return data
    } catch (error) {
      console.error('Error fetching compliance status:', error)
      throw error
    }
  }

  async getComplianceAlerts(params?: Record<string, any>) {
    try {
      const { data } = await this.client.get('/compliance/alerts', { params })
      return data
    } catch (error) {
      console.error('Error fetching compliance alerts:', error)
      throw error
    }
  }

  async overrideComplianceFlags(transactionId: string, flags: any[]) {
    try {
      const { data } = await this.client.post('/transactions/compliance-check', {
        transaction_id: transactionId,
        trigger_type: 'override',
        override_flags: flags,
      })
      return data
    } catch (error) {
      console.error('Error overriding compliance flags:', error)
      throw error
    }
  }

}

export const vaultAPI = new VaultAPI()
