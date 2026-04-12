// Agent types for the onboarding system

export type AgentStatus = 'pending_onboarding' | 'awaiting_signature' | 'approved' | 'rejected' | 'active' | 'inactive';

export interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  workspace_email: string;
  status: AgentStatus;
  docusign_envelope_id?: string;
  signed_at?: string;
  approved_at?: string;
  docusign_signed_document_url?: string;
  created_at: string;
  updated_at: string;
  supabase_user_id?: string;
}

export interface CreateAgentRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export interface AgentResponse {
  success: boolean;
  data?: Agent;
  error?: string;
}

export interface DocuSignEnvelope {
  envelopeId: string;
  status: string;
  statusDateTime: string;
  documentStatuses?: Array<{
    documentId: string;
    name: string;
  }>;
}

export interface DocuSignWebhookPayload {
  eventNotification?: {
    envelopeStatus?: {
      envelopeId: string;
      status: string;
      uri?: string;
      documentStatuses?: Array<{
        documentId: string;
        name: string;
      }>;
    };
  };
}
