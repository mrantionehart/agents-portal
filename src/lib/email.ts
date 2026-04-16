/**
 * Email Integration Utility Functions
 */

/**
 * Fetch email accounts
 */
export async function fetchEmailAccounts() {
  const response = await fetch('/api/broker/email/accounts');
  if (!response.ok) throw new Error('Failed to fetch email accounts');
  return response.json();
}

/**
 * Connect email account
 */
export async function connectEmailAccount(data: {
  email_address: string;
  provider: 'gmail' | 'outlook' | 'imap' | 'sendgrid';
  auth_token: string;
  refresh_token?: string;
  auto_sync_enabled?: boolean;
}) {
  const response = await fetch('/api/broker/email/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to connect email account');
  return response.json();
}

/**
 * Fetch inbox threads
 */
export async function fetchInbox(filters?: {
  account_id?: string;
  unread?: boolean;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.account_id) params.append('account_id', filters.account_id);
  if (filters?.unread) params.append('unread', 'true');
  params.append('page', String(filters?.page || 1));
  params.append('limit', String(filters?.limit || 25));

  const response = await fetch(`/api/broker/email/inbox?${params}`);
  if (!response.ok) throw new Error('Failed to fetch inbox');
  return response.json();
}

/**
 * Fetch email templates
 */
export async function fetchEmailTemplates(filters?: {
  category?: string;
  active?: boolean;
}) {
  const params = new URLSearchParams();

  if (filters?.category) params.append('category', filters.category);
  if (filters?.active !== undefined) {
    params.append('active', String(filters.active));
  }

  const response = await fetch(`/api/broker/email/templates?${params}`);
  if (!response.ok) throw new Error('Failed to fetch templates');
  return response.json();
}

/**
 * Create email template
 */
export async function createEmailTemplate(data: {
  name: string;
  category: string;
  description?: string;
  subject: string;
  body: string;
  is_active?: boolean;
}) {
  const response = await fetch('/api/broker/email/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to create template');
  return response.json();
}

/**
 * Send email
 */
export async function sendEmail(data: {
  email_account_id: string;
  to_email: string;
  subject: string;
  html_body?: string;
  transaction_id?: string;
  lead_id?: string;
  template_id?: string;
  template_variables?: Record<string, any>;
}) {
  const response = await fetch('/api/broker/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to send email');
  return response.json();
}

/**
 * Send email from template
 */
export async function sendEmailFromTemplate(
  emailAccountId: string,
  toEmail: string,
  templateId: string,
  variables?: Record<string, any>,
  leadId?: string,
  transactionId?: string
) {
  return sendEmail({
    email_account_id: emailAccountId,
    to_email: toEmail,
    template_id: templateId,
    template_variables: variables,
    lead_id: leadId,
    transaction_id: transactionId,
    subject: '', // Subject comes from template
    html_body: '' // Body comes from template
  });
}

/**
 * Substitute template variables
 */
export function substituteTemplateVariables(
  template: string,
  variables: Record<string, any>
): string {
  let result = template;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(
      new RegExp(placeholder, 'g'),
      String(value || '')
    );
  });

  return result;
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format email subject
 */
export function formatEmailSubject(subject: string, maxLength: number = 78): string {
  if (subject.length <= maxLength) return subject;
  return subject.slice(0, maxLength - 3) + '...';
}

/**
 * Extract email domain
 */
export function extractEmailDomain(email: string): string {
  const [, domain] = email.split('@');
  return domain || '';
}

/**
 * Format email address display
 */
export function formatEmailAddress(email: string, name?: string): string {
  if (name) {
    return `${name} <${email}>`;
  }
  return email;
}

/**
 * Check if email is from domain
 */
export function isEmailFromDomain(email: string, domain: string): boolean {
  return extractEmailDomain(email).toLowerCase() === domain.toLowerCase();
}

/**
 * Extract email recipients
 */
export function extractRecipients(emailString: string): string[] {
  return emailString
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter((email) => isValidEmail(email));
}

/**
 * Format template preview
 */
export function formatTemplatePreview(
  template: string,
  variables: Record<string, any> = {},
  maxLength: number = 200
): string {
  let preview = substituteTemplateVariables(template, variables);
  preview = preview.replace(/<[^>]*>/g, ''); // Remove HTML tags
  preview = preview.replace(/\s+/g, ' '); // Normalize whitespace

  if (preview.length > maxLength) {
    preview = preview.slice(0, maxLength - 3) + '...';
  }

  return preview;
}

/**
 * Get template category color
 */
export function getTemplateCategoryColor(category: string): string {
  const colors: { [key: string]: string } = {
    follow_up: 'bg-blue-100 text-blue-800',
    listing: 'bg-green-100 text-green-800',
    offer: 'bg-purple-100 text-purple-800',
    closing: 'bg-yellow-100 text-yellow-800',
    inquiry: 'bg-gray-100 text-gray-800',
    general: 'bg-gray-100 text-gray-800'
  };

  return colors[category] || 'bg-gray-100 text-gray-800';
}

/**
 * Build email tracking pixel URL
 */
export function buildTrackingPixelUrl(trackingId: string): string {
  return `/api/broker/email/tracking/${trackingId}/pixel.gif`;
}

/**
 * Extract URLs from HTML
 */
export function extractUrlsFromHtml(html: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]*)/g;
  const matches = html.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Generate greeting based on time
 */
export function generateTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Format email date
 */
export function formatEmailDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
}

/**
 * Create mailto link
 */
export function createMailtoLink(email: string, subject?: string): string {
  let link = `mailto:${email}`;
  if (subject) {
    link += `?subject=${encodeURIComponent(subject)}`;
  }
  return link;
}
