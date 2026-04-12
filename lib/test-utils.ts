/**
 * Test Utilities for Agent Portal
 * Helper functions for testing role-based filtering, API calls, and data validation
 */

/**
 * Test Data Generator
 * Creates realistic test data for testing
 */
export const testDataGenerator = {
  /**
   * Generate test deals for an agent
   */
  generateDeals: (agentId: string, count: number = 5) => {
    const deals = []
    const statuses = ['active', 'closed', 'pending']
    const propertyTypes = ['residential', 'commercial', 'condo', 'land']

    for (let i = 0; i < count; i++) {
      deals.push({
        id: `deal_${agentId}_${i}`,
        agent_id: agentId,
        agent_name: `Agent ${agentId.slice(0, 4).toUpperCase()}`,
        property_address: `${100 + i * 10} Main Street, Suite ${i + 1}`,
        property_type: propertyTypes[i % propertyTypes.length],
        contract_price: 250000 + i * 100000,
        status: statuses[i % statuses.length],
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      })
    }
    return deals
  },

  /**
   * Generate test commissions for deals
   */
  generateCommissions: (agentId: string, dealCount: number = 5) => {
    const commissions = []

    for (let i = 0; i < dealCount; i++) {
      const grossCommission = (250000 + i * 100000) * 0.05
      const agentShare = grossCommission * 0.8

      commissions.push({
        id: `comm_${agentId}_${i}`,
        agent_id: agentId,
        deal_id: `deal_${agentId}_${i}`,
        gross_commission: Math.round(grossCommission),
        agent_amount: Math.round(agentShare),
        broker_amount: Math.round(grossCommission - agentShare),
        status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'approved' : 'paid',
      })
    }
    return commissions
  },

  /**
   * Generate test documents
   */
  generateDocuments: (agentId: string, count: number = 3) => {
    const documents = []
    const categories = ['Listing Agreements', 'Buyer Documents', 'Offer & Contract', 'Closing Documents']

    for (let i = 0; i < count; i++) {
      documents.push({
        id: `doc_${agentId}_${i}`,
        agent_id: agentId,
        name: `Document_${i + 1}.pdf`,
        category: categories[i % categories.length],
        size: 1024 * (50 + Math.random() * 950), // 50KB to 1MB
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      })
    }
    return documents
  },
}

/**
 * Validation Utilities
 * Check if API responses and data are valid
 */
export const validators = {
  /**
   * Validate deal structure
   */
  validateDeal: (deal: any): string[] => {
    const errors: string[] = []

    if (!deal.id) errors.push('Missing deal.id')
    if (!deal.agent_id) errors.push('Missing deal.agent_id')
    if (!deal.property_address) errors.push('Missing deal.property_address')
    if (typeof deal.contract_price !== 'number') errors.push('Invalid deal.contract_price')
    if (!deal.status) errors.push('Missing deal.status')

    return errors
  },

  /**
   * Validate commission structure
   */
  validateCommission: (commission: any): string[] => {
    const errors: string[] = []

    if (!commission.id) errors.push('Missing commission.id')
    if (!commission.agent_id) errors.push('Missing commission.agent_id')
    if (typeof commission.gross_commission !== 'number')
      errors.push('Invalid commission.gross_commission')
    if (typeof commission.agent_amount !== 'number') errors.push('Invalid commission.agent_amount')
    if (!commission.status) errors.push('Missing commission.status')

    return errors
  },

  /**
   * Validate API response structure
   */
  validateApiResponse: (response: any): string[] => {
    const errors: string[] = []

    if (!response) errors.push('Response is null or undefined')
    if (typeof response !== 'object') errors.push('Response is not an object')

    return errors
  },

  /**
   * Validate role-based filtering
   */
  validateRoleFiltering: (deals: any[], agentId: string, role: string): string[] => {
    const errors: string[] = []

    if (role === 'agent') {
      // Agent should only see their own deals
      const incorrectDeals = deals.filter((d) => d.agent_id !== agentId)
      if (incorrectDeals.length > 0) {
        errors.push(
          `Agent sees deals from other agents: ${incorrectDeals.map((d) => d.agent_id).join(', ')}`
        )
      }
    } else if (role === 'broker' || role === 'admin') {
      // Admin should see all deals
      // (no validation - should see all)
    }

    return errors
  },
}

/**
 * API Testing Utilities
 * Helper functions for testing API calls
 */
export const apiTesters = {
  /**
   * Test API endpoint with headers
   */
  testEndpoint: async (
    endpoint: string,
    userId: string,
    userRole: string,
    method: string = 'GET'
  ) => {
    const url = `http://192.168.6.88:3000${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      'X-User-ID': userId,
      'X-User-Role': userRole,
    }

    console.log(`Testing ${method} ${endpoint}`)
    console.log(`Headers:`, headers)

    try {
      const response = await fetch(url, { method, headers })
      const data = await response.json()

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },

  /**
   * Test data filtering
   * Verify that agent and broker see correct data
   */
  testDataFiltering: async (userId: string, agentId: string, role: string) => {
    const endpoint = '/api/deals'

    const result = await apiTesters.testEndpoint(endpoint, userId, role)

    if (!result.success) {
      return {
        passed: false,
        error: `API call failed: ${result.status}`,
      }
    }

    const deals = result.data.deals || result.data.data || []
    const filteringErrors = validators.validateRoleFiltering(deals, agentId, role)

    return {
      passed: filteringErrors.length === 0,
      dealCount: deals.length,
      errors: filteringErrors,
    }
  },
}

/**
 * Assertion Utilities
 * Test assertions for validation
 */
export const assertions = {
  /**
   * Assert value equals expected
   */
  assertEqual: (actual: any, expected: any, message: string): boolean => {
    const passed = actual === expected
    if (!passed) {
      console.error(`❌ ${message}`)
      console.error(`   Expected: ${expected}`)
      console.error(`   Actual: ${actual}`)
    } else {
      console.log(`✅ ${message}`)
    }
    return passed
  },

  /**
   * Assert array contains only agent's data
   */
  assertAgentDataIsolation: (deals: any[], agentId: string, message: string): boolean => {
    const isIsolated = deals.every((d) => d.agent_id === agentId)
    if (!isIsolated) {
      console.error(`❌ ${message} - Agent sees data from other agents`)
    } else {
      console.log(`✅ ${message}`)
    }
    return isIsolated
  },

  /**
   * Assert response is valid JSON
   */
  assertValidJson: (data: any, message: string): boolean => {
    try {
      if (typeof data === 'object') {
        console.log(`✅ ${message}`)
        return true
      }
    } catch (e) {
      console.error(`❌ ${message} - Invalid JSON`)
      return false
    }
    return false
  },

  /**
   * Assert API call includes required headers
   */
  assertHeadersPresent: (headers: Record<string, string>, message: string): boolean => {
    const hasUserId = !!headers['X-User-ID']
    const hasRole = !!headers['X-User-Role']

    if (hasUserId && hasRole) {
      console.log(`✅ ${message}`)
      return true
    } else {
      console.error(`❌ ${message}`)
      if (!hasUserId) console.error('   Missing X-User-ID header')
      if (!hasRole) console.error('   Missing X-User-Role header')
      return false
    }
  },
}

/**
 * Test Suite Runner
 * Run a series of tests and report results
 */
export class TestSuite {
  name: string
  tests: Array<{ name: string; fn: () => Promise<boolean> | boolean }> = []
  results: Array<{ name: string; passed: boolean; error?: string }> = []

  constructor(name: string) {
    this.name = name
  }

  addTest(name: string, fn: () => Promise<boolean> | boolean) {
    this.tests.push({ name, fn })
  }

  async run() {
    console.log(`\n🧪 Running Test Suite: ${this.name}`)
    console.log('='.repeat(50))

    for (const test of this.tests) {
      try {
        const passed = await test.fn()
        this.results.push({
          name: test.name,
          passed,
        })
      } catch (error) {
        this.results.push({
          name: test.name,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    this.printReport()
  }

  printReport() {
    const passed = this.results.filter((r) => r.passed).length
    const total = this.results.length
    const percentage = Math.round((passed / total) * 100)

    console.log(`\n📊 Test Results: ${passed}/${total} passed (${percentage}%)`)
    console.log('='.repeat(50))

    this.results.forEach((result) => {
      const icon = result.passed ? '✅' : '❌'
      console.log(`${icon} ${result.name}`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })

    console.log('='.repeat(50))
    return { passed, total, percentage }
  }
}

/**
 * Browser Console Testing
 * Run these in browser DevTools console
 */
export const consoleTests = {
  /**
   * Monitor API calls in real-time
   * Paste in DevTools console to see all API calls with headers
   */
  monitorApiCalls: () => {
    const originalFetch = window.fetch
    window.fetch = function (...args: any[]) {
      const [resource, config] = args
      console.log('📡 API Call:', {
        url: resource,
        method: config?.method || 'GET',
        headers: config?.headers,
        timestamp: new Date().toISOString(),
      })
      return originalFetch.apply(this, args)
    }
    console.log('✅ API call monitoring enabled')
  },

  /**
   * Check if X-User-Role header is present
   * Copy results from Network tab
   */
  validateHeaders: (headerText: string) => {
    const hasUserId = headerText.includes('X-User-ID')
    const hasRole = headerText.includes('X-User-Role')
    console.log({
      'X-User-ID Present': hasUserId,
      'X-User-Role Present': hasRole,
      'Both Present': hasUserId && hasRole,
    })
  },
}
