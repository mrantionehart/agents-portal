/**
 * Email Integration System Type Definitions
 */

export interface EmailAccount {
  id: string;
  broker_id: string;
  email_address: string;
  provider: 'gmail' | 'outlook' | 'imap' | 'sendgrid';
  auth_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  sync_status: 'idle' | 'syncing' | 'error';
  last_sync_date?: string;
  sync_error_message?: string;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  email_account_id: string;
  message_id?: string;
  thread_id?: string;
  from_email: string;
  to_email: string;
  cc_emails?: string;
  subject: string;
  body?: string;
  html_body?: string;
  read: boolean;
  archived: boolean;
  starred?: boolean;
  transaction_id?: string;
  lead_id?: string;
  direction: 'inbound' | 'outbound';
  received_date: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  broker_id: string;
  name: string;
  category: 'follow_up' | 'listing' | 'offer' | 'closing' | 'inquiry' | 'general';
  description?: string;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTracking {
  id: string;
  message_id: string;
  recipient_email: string;
  opened: boolean;
  first_opened_date?: string;
  last_opened_date?: string;
  open_count: number;
  click_count: number;
  links_clicked?: Array<{
    url: string;
    clicked_at: string;
  }>;
  last_click_date?: string;
  sent_date: string;
  bounced: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_size?: number;
  file_path?: string;
  mime_type?: string;
  storage_bucket?: string;
  storage_key?: string;
  created_at: string;
}

export interface CreateEmailAccountRequest {
  email_address: string;
  provider: 'gmail' | 'outlook' | 'imap' | 'sendgrid';
  auth_token: string;
  refresh_token?: string;
  auto_sync_enabled?: boolean;
  sync_interval_minutes?: number;
}

export interface CreateEmailTemplateRequest {
  name: string;
  category: 'follow_up' | 'listing' | 'offer' | 'closing' | 'inquiry' | 'general';
  description?: string;
  subject: string;
  body: string;
  is_active?: boolean;
}

export interface SendEmailRequest {
  email_account_id: string;
  to_email: string;
  subject: string;
  html_body?: string;
  transaction_id?: string;
  lead_id?: string;
  template_id?: string;
  template_variables?: Record<string, any>;
}

export interface EmailInboxResponse {
  threads: EmailMessage[][];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface EmailTrackingData {
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
}
