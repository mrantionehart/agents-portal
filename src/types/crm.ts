/**
 * CRM System Type Definitions
 * Comprehensive types for leads, contacts, and interactions
 */

export interface Lead {
  id: string;
  agent_id: string;
  broker_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  property_type: 'buy' | 'sell' | 'both';
  estimated_timeline?: string;
  budget_price_range?: {
    min?: number;
    max?: number;
  };
  status: 'new' | 'contacted' | 'qualified' | 'negotiating' | 'closed' | 'lost';
  source: string;
  lead_score: number;
  temperature: 'hot' | 'warm' | 'cold';
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  interaction_type: 'call' | 'email' | 'meeting' | 'text' | 'other';
  interaction_date: string;
  duration_minutes?: number;
  notes?: string;
  outcome?: 'positive' | 'neutral' | 'negative';
  next_followup_date?: string;
  created_by: string;
  created_at: string;
}

export interface Contact {
  id: string;
  broker_id: string;
  type: 'buyer' | 'seller' | 'other';
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  relationship_strength: 1 | 2 | 3 | 4 | 5;
  last_contact_date?: string;
  contact_history: any[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface LeadPipeline {
  id: string;
  agent_id: string;
  pipeline_date: string;
  total_leads: number;
  by_status: {
    new: number;
    contacted: number;
    qualified: number;
    negotiating: number;
    closed: number;
    lost: number;
  };
  total_value: number;
  average_deal_value: number;
  conversion_rate: number;
  created_at: string;
}

export interface LeadSource {
  id: string;
  broker_id: string;
  name: string;
  type: string;
  cost_per_lead: number;
  total_cost: number;
  leads_generated: number;
  conversion_rate: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineAnalytics {
  total_leads: number;
  by_status: {
    new: number;
    contacted: number;
    qualified: number;
    negotiating: number;
    closed: number;
    lost: number;
  };
  by_temperature: {
    hot: number;
    warm: number;
    cold: number;
  };
  average_lead_score: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
}

export interface SourceAnalytics {
  source: string;
  total_leads: number;
  closed_deals: number;
  conversion_rate: string;
  average_lead_score: string;
}

export interface ConversionAnalytics {
  agent_id: string;
  source: string;
  total_leads: number;
  converted_leads: number;
  conversion_rate: string;
}

export interface CreateLeadRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  property_type: 'buy' | 'sell' | 'both';
  estimated_timeline?: string;
  budget_price_range?: {
    min?: number;
    max?: number;
  };
  status?: 'new' | 'contacted' | 'qualified' | 'negotiating' | 'closed' | 'lost';
  source: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateLeadRequest {
  status?: 'new' | 'contacted' | 'qualified' | 'negotiating' | 'closed' | 'lost';
  notes?: string;
  lead_score?: number;
  temperature?: 'hot' | 'warm' | 'cold';
  tags?: string[];
  budget_price_range?: {
    min?: number;
    max?: number;
  };
}

export interface CreateInteractionRequest {
  interaction_type: 'call' | 'email' | 'meeting' | 'text' | 'other';
  interaction_date: string;
  duration_minutes?: number;
  notes?: string;
  outcome?: 'positive' | 'neutral' | 'negative';
  next_followup_date?: string;
}

export interface CreateContactRequest {
  type?: 'buyer' | 'seller' | 'other';
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  relationship_strength?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
}
