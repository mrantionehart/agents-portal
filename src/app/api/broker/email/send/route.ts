import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// POST /api/broker/email/send
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get(name: string) { return cookies().get(name)?.value; }, set(name: string, value: string, options: CookieOptions) { cookies().set({ name, value, ...options }); }, remove(name: string, options: CookieOptions) { cookies().delete(name); } } });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('broker_id')
      .eq('id', user.id)
      .single();

    const body = await request.json();
    const {
      email_account_id,
      to_email,
      subject,
      html_body,
      transaction_id,
      lead_id,
      template_id,
      template_variables
    } = body;

    if (!email_account_id || !to_email || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let emailBody = html_body;

    // If using a template
    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('subject, body')
        .eq('id', template_id)
        .single();

      if (templateError) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      // Substitute variables
      emailBody = substituteVariables(template.body, template_variables || {});
    }

    // Create message record
    const { data: message, error: messageError } = await supabase
      .from('email_messages')
      .insert([
        {
          email_account_id,
          from_email: (await getAccountEmail(supabase, email_account_id)) || 'no-reply@hartfelt.com',
          to_email,
          subject,
          body: emailBody,
          html_body: emailBody,
          direction: 'outbound',
          received_date: new Date().toISOString(),
          transaction_id,
          lead_id
        }
      ])
      .select()
      .single();

    if (messageError) throw messageError;

    // Create tracking record
    const { data: tracking, error: trackingError } = await supabase
      .from('email_tracking')
      .insert([
        {
          message_id: message.id,
          recipient_email: to_email,
          sent_date: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (trackingError) throw trackingError;

    // In production, actually send the email via SendGrid or other service
    // For now, we'll just record it

    return NextResponse.json({
      message_id: message.id,
      tracking_id: tracking.id,
      status: 'queued'
    }, { status: 201 });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

function substituteVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value || ''));
  });
  return result;
}

async function getAccountEmail(supabase: any, accountId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('email_accounts')
    .select('email_address')
    .eq('id', accountId)
    .single();

  if (error) return null;
  return data?.email_address || null;
}
