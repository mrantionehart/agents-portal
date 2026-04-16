// Utility Functions for MLS and Integration Features

import {
  MLSListing,
  ExternalServiceRequest,
  PropertyValuation,
  MarketAnalysis,
} from '@/types/integrations'

/**
 * Format currency values
 */
export const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format date consistently
 */
export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Invalid Date'
  }
}

/**
 * Get MLS listing display name
 */
export const getMLSListingDisplay = (listing: MLSListing): string => {
  return `${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}`
}

/**
 * Check if MLS listing is available (not sold/withdrawn)
 */
export const isMLSListingAvailable = (listing: MLSListing): boolean => {
  return !['sold', 'withdrawn', 'expired'].includes(listing.status)
}

/**
 * Get status badge styling
 */
export const getStatusBadgeClass = (
  status: string,
  context: 'listing' | 'service' | 'valuation' = 'listing'
): string => {
  if (context === 'listing') {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'sold':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-red-100 text-red-800'
    }
  }

  if (context === 'service') {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      case 'submitted':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return 'bg-gray-100 text-gray-800'
}

/**
 * Calculate days on market from list date
 */
export const calculateDaysOnMarket = (listDate: string | undefined): number | null => {
  if (!listDate) return null
  const today = new Date()
  const listed = new Date(listDate)
  const diff = today.getTime() - listed.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Check for property valuation discrepancies
 */
export const checkValuationDiscrepancies = (
  valuations: PropertyValuation[],
  threshold: number = 0.15
): { hasDiscrepancy: boolean; variance: number; message: string } => {
  if (valuations.length < 2) {
    return { hasDiscrepancy: false, variance: 0, message: 'Not enough valuations to compare' }
  }

  const amounts = valuations.map(v => v.value_amount).sort((a, b) => a - b)
  const min = amounts[0]
  const max = amounts[amounts.length - 1]
  const variance = (max - min) / min

  return {
    hasDiscrepancy: variance > threshold,
    variance,
    message:
      variance > threshold
        ? `Valuations vary by ${(variance * 100).toFixed(1)}% (${formatCurrency(min)} - ${formatCurrency(max)})`
        : `Valuations are consistent (variance: ${(variance * 100).toFixed(1)}%)`,
  }
}

/**
 * Get market heat indicator
 */
export const getMarketHeat = (
  analysis: MarketAnalysis | null
): { label: string; color: string; description: string } => {
  if (!analysis?.trends) {
    return { label: 'Unknown', color: 'gray', description: 'Insufficient data' }
  }

  const trend = analysis.trends.price_trend_12m || 0
  const inventory = analysis.trends.inventory_trend || 0

  if (trend > 5 && inventory < 10) {
    return {
      label: 'Hot',
      color: 'red',
      description: 'Sellers market with strong appreciation',
    }
  }
  if (trend > 2 && inventory < 25) {
    return {
      label: 'Warm',
      color: 'orange',
      description: 'Favorable market conditions',
    }
  }
  if (trend > -2 && trend <= 2) {
    return {
      label: 'Stable',
      color: 'blue',
      description: 'Balanced market conditions',
    }
  }
  if (trend > -5 && trend <= -2) {
    return {
      label: 'Cool',
      color: 'cyan',
      description: 'Buyers market with some appreciation loss',
    }
  }
  return {
    label: 'Cold',
    color: 'gray',
    description: 'Buyers market with declining prices',
  }
}

/**
 * Calculate consensus valuation from multiple sources
 */
export const calculateConsensusValuation = (
  valuations: PropertyValuation[],
  minConfidence: number = 0.5
): number | null => {
  const qualified = valuations.filter(v => v.confidence_score >= minConfidence)

  if (qualified.length === 0) return null

  const sorted = qualified.map(v => v.value_amount).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]

  return median
}

/**
 * Format property details for display
 */
export const formatPropertyDetails = (listing: MLSListing): Record<string, string> => {
  const details: Record<string, string> = {}

  if (listing.property_details?.beds) details['Bedrooms'] = listing.property_details.beds.toString()
  if (listing.property_details?.baths) details['Bathrooms'] = listing.property_details.baths.toString()
  if (listing.property_details?.sqft) details['Square Feet'] = listing.property_details.sqft.toLocaleString()
  if (listing.property_details?.lot_size) details['Lot Size'] = listing.property_details.lot_size.toString()
  if (listing.property_details?.year_built) details['Year Built'] = listing.property_details.year_built.toString()

  return details
}

/**
 * Check if service request is actionable
 */
export const isServiceRequestActionable = (request: ExternalServiceRequest): boolean => {
  return !['completed', 'failed', 'cancelled'].includes(request.status)
}

/**
 * Get human-readable service request status
 */
export const getServiceRequestStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Awaiting Submission',
    submitted: 'Submitted to Service',
    in_progress: 'Service in Progress',
    completed: 'Service Complete',
    failed: 'Service Failed',
    cancelled: 'Request Cancelled',
  }

  return labels[status] || status
}

/**
 * Calculate property appreciation/depreciation
 */
export const calculateAppreciation = (
  previousValue: number,
  currentValue: number
): { percentage: number; direction: 'up' | 'down' | 'stable' } => {
  const percentage = ((currentValue - previousValue) / previousValue) * 100

  return {
    percentage,
    direction: percentage > 0.5 ? 'up' : percentage < -0.5 ? 'down' : 'stable',
  }
}

/**
 * Validate MLS address format
 */
export const validateMLSAddress = (address: string, city: string, state: string): boolean => {
  return address.length >= 5 && city.length >= 2 && state.length === 2
}

/**
 * Get MLS data sync status
 */
export const getMLSSyncStatus = (
  lastSync: string | null
): { isRecent: boolean; message: string } => {
  if (!lastSync) {
    return { isRecent: false, message: 'Never synced' }
  }

  const lastSyncDate = new Date(lastSync)
  const now = new Date()
  const hoursAgo = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60)

  if (hoursAgo < 1) {
    return { isRecent: true, message: 'Synced just now' }
  }
  if (hoursAgo < 24) {
    return { isRecent: true, message: `Synced ${Math.round(hoursAgo)} hours ago` }
  }
  if (hoursAgo < 48) {
    return { isRecent: true, message: 'Synced 1 day ago' }
  }

  return { isRecent: false, message: `Synced ${Math.round(hoursAgo / 24)} days ago` }
}

/**
 * Generate MLS report
 */
export const generateMLSReport = (listing: MLSListing): string => {
  const lines: string[] = [
    `MLS Listing Report`,
    `Generated: ${formatDate(new Date().toISOString())}`,
    ``,
    `Property Information:`,
    `Address: ${getMLSListingDisplay(listing)}`,
    `MLS #: ${listing.mls_number}`,
    `Type: ${listing.listing_type}`,
    `Status: ${listing.status}`,
    ``,
    `Pricing:`,
    `List Price: ${formatCurrency(listing.list_price)}`,
    listing.sold_price ? `Sold Price: ${formatCurrency(listing.sold_price)}` : '',
    listing.price_per_sqft ? `Price per Sqft: $${listing.price_per_sqft.toFixed(2)}` : '',
    ``,
    `Dates:`,
    `Listed: ${formatDate(listing.list_date)}`,
    listing.sold_date ? `Sold: ${formatDate(listing.sold_date)}` : '',
    listing.days_on_market ? `Days on Market: ${listing.days_on_market}` : '',
  ]

  return lines.filter(line => line !== '').join('\n')
}
