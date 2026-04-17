import axios, { AxiosInstance } from 'axios'
import { supabase } from './supabase'

const vaultApiUrl = process.env.NEXT_PUBLIC_VAULT_API_URL || 'http://192.168.6.88:3000/api'

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

    // Add request interceptor for auth token from Supabase session
    this.client.interceptors.request.use(async (config) => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`
        }
      } catch (error) {
        console.error('Error getting auth token from Supabase:', error)
      }
      return config
    })
  }

  // Deals endpoints
  async getDeals(filters?: Record<string, any>) {
    try {
      const { data } = await this.client.get('/deals', { params: filters })
      return data
    } catch (error) {
      console.error('Error fetching deals:', error)
      throw error
    }
  }

  async getDeal(dealId: string) {
    try {
      const { data } = await this.client.get(`/deals/${dealId}`)
      return data
    } catch (error) {
      console.error('Error fetching deal:', error)
      throw error
    }
  }

  async createDeal(dealData: Record<string, any>) {
    try {
      const { data } = await this.client.post('/deals', dealData)
      return data
    } catch (error) {
      console.error('Error creating deal:', error)
      throw error
    }
  }

  async updateDeal(dealId: string, dealData: Record<string, any>) {
    try {
      const { data } = await this.client.put(`/deals/${dealId}`, dealData)
      return data
    } catch (error) {
      console.error('Error updating deal:', error)
      throw error
    }
  }

  async deleteDeal(dealId: string) {
    try {
      const { data } = await this.client.delete(`/deals/${dealId}`)
      return data
    } catch (error) {
      console.error('Error deleting deal:', error)
      throw error
    }
  }

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
