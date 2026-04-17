// ---------------------------------------------------------------------------
// POST /api/compliance/scan
//
// Performs a compliance scan on an agent's documents. Checks for missing
// signatures, expired documents, and missing required docs. Creates
// compliance_checks, compliance_issues, compliance_alerts records, sends
// notifications, and optionally emails the agent via SendGrid.
//
// Auth: Supabase session cookie (portal) OR Bearer token (EASE).
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FROM_EMAIL = 'info@hartfeltrealestate.com';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Service-role client — bypasses RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthedUser(
  request: NextRequest
): Promise<{ userId: string } | null> {
  // 1. Bearer token (mobile / curl)
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data.user) return null;
      return { userId: data.user.id };
    } catch {
      return null;
    }
  }

  // 2. SSR cookie (portal)
  try {
    const stubResponse = NextResponse.json({});
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            stubResponse.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            stubResponse.cookies.delete(name);
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { userId: user.id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ComplianceIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  document_id?: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // ---- Auth ----
    const caller = await getAuthedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // ---- Parse body ----
    const body = await request.json();
    const { agent_id, trigger_type = 'manual' } = body as {
      agent_id: string;
      trigger_type?: 'manual' | 'auto_upload' | 'scheduled';
    };

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    console.log(
      `[compliance/scan] Starting scan for agent=${agent_id} trigger=${trigger_type} by=${caller.userId}`
    );

    const admin = getAdminClient();
    const now = new Date().toISOString();
    const issues: ComplianceIssue[] = [];

    // ------------------------------------------------------------------
    // 1. Fetch agent documents
    // ------------------------------------------------------------------
    const { data: documents, error: docErr } = await admin
      .from('documents')
      .select('*')
      .eq('uploaded_by', agent_id);

    if (docErr) {
      console.error('[compliance/scan] Error fetching documents:', docErr);
      return NextResponse.json(
        { error: 'Failed to fetch documents', detail: docErr.message },
        { status: 500 }
      );
    }

    const docs = documents || [];
    console.log(`[compliance/scan] Found ${docs.length} documents for agent`);

    // ------------------------------------------------------------------
    // 2. Fetch document analysis records (for signature checks)
    // ------------------------------------------------------------------
    let analysisMap: Record<string, any> = {};
    if (docs.length > 0) {
      const docIds = docs.map((d: any) => d.id);
      const { data: analyses, error: analysisErr } = await admin
        .from('document_analysis')
        .select('*')
        .in('document_id', docIds);

      if (analysisErr) {
        console.error(
          '[compliance/scan] Error fetching document_analysis:',
          analysisErr
        );
        // Non-fatal — continue without analysis data
      } else if (analyses) {
        for (const a of analyses) {
          analysisMap[a.document_id] = a;
        }
      }
    }

    // ------------------------------------------------------------------
    // 3. Check each document for issues
    // ------------------------------------------------------------------

    // 3a. Missing signatures
    for (const doc of docs) {
      const analysis = analysisMap[doc.id];
      const signaturesFound =
        analysis?.signatures_found ??
        analysis?.signature_found ??
        null;

      const hasMissingSig =
        !analysis ||
        signaturesFound === null ||
        signaturesFound === undefined ||
        (Array.isArray(signaturesFound) && signaturesFound.length === 0) ||
        signaturesFound === 0 ||
        signaturesFound === false;

      if (hasMissingSig) {
        issues.push({
          severity: 'critical',
          category: 'missing_signature',
          title: 'Signature verification needed',
          description: `Document "${doc.name || doc.file_name || doc.id}" requires signature verification. ${
            !analysis
              ? 'No analysis record found.'
              : 'Signatures not detected.'
          }`,
          document_id: doc.id,
        });
      }
    }

    // 3b. Expired documents
    for (const doc of docs) {
      if (doc.expires_at) {
        const expiresAt = new Date(doc.expires_at);
        if (expiresAt < new Date()) {
          issues.push({
            severity: 'warning',
            category: 'expired_document',
            title: 'Document expired',
            description: `Document "${doc.name || doc.file_name || doc.id}" expired on ${expiresAt.toLocaleDateString()}.`,
            document_id: doc.id,
          });
        }
      }
    }

    // 3c. Missing required documents (basic threshold: fewer than 3)
    const REQUIRED_DOC_THRESHOLD = 3;
    if (docs.length < REQUIRED_DOC_THRESHOLD) {
      const missing = REQUIRED_DOC_THRESHOLD - docs.length;
      issues.push({
        severity: 'warning',
        category: 'missing_required_document',
        title: 'Missing required documents',
        description: `Agent has ${docs.length} document(s) uploaded, which is below the minimum threshold of ${REQUIRED_DOC_THRESHOLD}. ${missing} more document(s) required.`,
      });
    }

    // ------------------------------------------------------------------
    // 4. Calculate score & status
    // ------------------------------------------------------------------
    let score = 100;
    for (const issue of issues) {
      if (issue.category === 'missing_signature') score -= 20;
      else if (issue.category === 'expired_document') score -= 15;
      else if (issue.category === 'missing_required_document') score -= 10;
    }
    score = Math.max(0, score);

    const overall_status =
      score >= 80 ? 'pass' : score >= 50 ? 'needs_review' : 'fail';

    const summary = issues.length === 0
      ? 'All compliance checks passed.'
      : `Found ${issues.length} issue(s): ${
          issues.filter((i) => i.severity === 'critical').length
        } critical, ${
          issues.filter((i) => i.severity === 'warning').length
        } warning(s).`;

    // ------------------------------------------------------------------
    // 5. Create compliance_checks record
    // ------------------------------------------------------------------
    const { data: checkRecord, error: checkErr } = await admin
      .from('compliance_checks')
      .insert({
        agent_id,
        triggered_by: caller.userId,
        trigger_type,
        overall_status,
        score,
        summary,
        created_at: now,
      })
      .select('id')
      .single();

    if (checkErr) {
      console.error(
        '[compliance/scan] Error creating compliance_checks record:',
        checkErr
      );
      return NextResponse.json(
        { error: 'Failed to create compliance check', detail: checkErr.message },
        { status: 500 }
      );
    }

    const check_id = checkRecord.id;
    console.log(`[compliance/scan] Created compliance check id=${check_id} score=${score}`);

    // ------------------------------------------------------------------
    // 6. Create compliance_issues records
    // ------------------------------------------------------------------
    if (issues.length > 0) {
      // Try with compliance_check_id first, fall back to check_id
      const issueRows = issues.map((issue) => ({
        compliance_check_id: check_id,
        check_id: check_id,
        transaction_id: null,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
        description: issue.description,
        is_resolved: false,
        created_at: now,
      }));

      // Attempt insert — if it fails due to unknown column, retry with the other key
      let issueInsertError = null;
      const { error: issueErr1 } = await admin
        .from('compliance_issues')
        .insert(
          issueRows.map(({ check_id: _cid, ...rest }) => rest)
        );

      if (issueErr1) {
        console.warn(
          '[compliance/scan] Insert with compliance_check_id failed, trying check_id:',
          issueErr1.message
        );
        const { error: issueErr2 } = await admin
          .from('compliance_issues')
          .insert(
            issueRows.map(({ compliance_check_id: _ccid, ...rest }) => rest)
          );

        if (issueErr2) {
          console.error(
            '[compliance/scan] Error creating compliance_issues:',
            issueErr2
          );
          issueInsertError = issueErr2;
        }
      }

      if (issueInsertError) {
        console.error(
          '[compliance/scan] Could not insert compliance_issues — continuing'
        );
      }
    }

    // ------------------------------------------------------------------
    // 7. Create compliance_alerts for critical issues
    // ------------------------------------------------------------------
    const criticalIssues = issues.filter((i) => i.severity === 'critical');
    let alertsCreated = 0;

    if (criticalIssues.length > 0) {
      const alertRows = criticalIssues.map((issue) => ({
        related_agent: agent_id,
        type: 'missing_signature',
        severity: 'warning',
        title: issue.title,
        message: issue.description,
        status: 'pending',
        created_at: now,
      }));

      const { error: alertErr } = await admin
        .from('compliance_alerts')
        .insert(alertRows);

      if (alertErr) {
        console.error(
          '[compliance/scan] Error creating compliance_alerts:',
          alertErr
        );
      } else {
        alertsCreated = alertRows.length;
      }
    }

    // ------------------------------------------------------------------
    // 8. Send notifications for critical issues
    // ------------------------------------------------------------------
    let notificationsSent = 0;

    if (criticalIssues.length > 0) {
      // 8a. In-app notifications
      const notifRows = criticalIssues.map((issue) => ({
        user_id: agent_id,
        type: 'admin_alert',
        status: 'unread',
        title: issue.title,
        body: issue.description,
        icon: '\u26A0\uFE0F',
        color: '#E85D6A',
        created_at: now,
      }));

      const { error: notifErr } = await admin
        .from('notifications')
        .insert(notifRows);

      if (notifErr) {
        console.error(
          '[compliance/scan] Error creating notifications:',
          notifErr
        );
      } else {
        notificationsSent += notifRows.length;
      }

      // 8b. Push notification queue
      const pushRows = criticalIssues.map((issue) => ({
        user_id: agent_id,
        title: issue.title,
        body: issue.description,
        data: JSON.stringify({ type: 'compliance_alert' }),
        status: 'pending',
        created_at: now,
      }));

      const { error: pushErr } = await admin
        .from('push_notification_queue')
        .insert(pushRows);

      if (pushErr) {
        console.error(
          '[compliance/scan] Error queuing push notifications:',
          pushErr
        );
      }
    }

    // ------------------------------------------------------------------
    // 9. Send email via SendGrid (critical issues only)
    // ------------------------------------------------------------------
    if (criticalIssues.length > 0 && process.env.SENDGRID_API_KEY) {
      try {
        // Fetch agent profile for email
        const { data: profile, error: profileErr } = await admin
          .from('profiles')
          .select('email, full_name, first_name, last_name')
          .eq('id', agent_id)
          .single();

        if (profileErr || !profile?.email) {
          console.error(
            '[compliance/scan] Could not fetch agent email for notification:',
            profileErr
          );
        } else {
          const agentName =
            profile.full_name ||
            [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
            'Agent';

          const issueListHtml = issues
            .map(
              (issue) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #E8ECF0;">
                  <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;color:#fff;background:${
                    issue.severity === 'critical'
                      ? '#E85D6A'
                      : issue.severity === 'warning'
                      ? '#F5A623'
                      : '#2E75B6'
                  };">${issue.severity.toUpperCase()}</span>
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid #E8ECF0;font-weight:600;color:#1F4E78;">
                  ${issue.title}
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid #E8ECF0;color:#555;">
                  ${issue.description}
                </td>
              </tr>`
            )
            .join('');

          const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#F4F6F8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1F4E78;padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                HartFelt Real Estate
              </h1>
              <p style="margin:6px 0 0;color:#A8C8E8;font-size:14px;">
                Compliance Scan Report
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#333;">
                Hello ${agentName},
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#333;">
                A compliance scan was performed on your documents and
                <strong>${issues.length} issue(s)</strong> were found that require your attention.
                Your current compliance score is <strong>${score}/100</strong>.
              </p>

              <!-- Score badge -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:${
                    score >= 80 ? '#27AE60' : score >= 50 ? '#F5A623' : '#E85D6A'
                  };color:#fff;padding:8px 20px;border-radius:6px;font-size:18px;font-weight:700;">
                    Score: ${score} / 100 &mdash; ${overall_status.replace('_', ' ').toUpperCase()}
                  </td>
                </tr>
              </table>

              <!-- Issues table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8ECF0;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                <tr style="background:#2E75B6;">
                  <th style="padding:10px 12px;text-align:left;color:#fff;font-size:13px;">Severity</th>
                  <th style="padding:10px 12px;text-align:left;color:#fff;font-size:13px;">Issue</th>
                  <th style="padding:10px 12px;text-align:left;color:#fff;font-size:13px;">Details</th>
                </tr>
                ${issueListHtml}
              </table>

              <p style="margin:0 0 20px;font-size:15px;color:#333;">
                Please log into the
                <a href="https://portal.hartfelt.com" style="color:#2E75B6;text-decoration:underline;">
                  HartFelt Portal
                </a>
                to resolve these issues as soon as possible.
              </p>

              <p style="margin:0;font-size:13px;color:#999;">
                This is an automated compliance notification from HartFelt Real Estate.
                If you believe this is in error, please contact your broker or
                <a href="mailto:support@hartfeltrealestate.com" style="color:#2E75B6;">support@hartfeltrealestate.com</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F4F6F8;padding:16px 32px;border-top:1px solid #E8ECF0;">
              <p style="margin:0;font-size:12px;color:#999;text-align:center;">
                HartFelt Real Estate &bull; Compliance Team
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

          await sgMail.send({
            to: profile.email,
            from: {
              email: FROM_EMAIL,
              name: 'HartFelt Compliance',
            },
            subject: `Compliance Alert: ${issues.length} issue(s) found — Score ${score}/100`,
            html: emailHtml,
          });

          console.log(
            `[compliance/scan] Compliance email sent to ${profile.email}`
          );
        }
      } catch (emailError) {
        // Email failure is non-fatal
        console.error(
          '[compliance/scan] SendGrid email failed (non-fatal):',
          emailError
        );
      }
    }

    // ------------------------------------------------------------------
    // 10. Return response
    // ------------------------------------------------------------------
    console.log(
      `[compliance/scan] Scan complete: check=${check_id} score=${score} issues=${issues.length} alerts=${alertsCreated} notifs=${notificationsSent}`
    );

    return NextResponse.json({
      check_id,
      score,
      overall_status,
      issues_count: issues.length,
      alerts_created: alertsCreated,
      notifications_sent: notificationsSent,
    });
  } catch (err) {
    console.error('[compliance/scan] Unhandled error:', err);
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 }
    );
  }
}
