// ---------------------------------------------------------------------------
// POST /api/licenses/check
//
// Scans all agents (or a specific agent) for:
//   1. Expiring real estate licenses (60 / 30 / 7 day thresholds)
//   2. Incomplete CE hours approaching renewal deadline
//   3. Already-expired licenses
//
// Creates license_notifications records, in-app notifications, and
// optionally sends emails via SendGrid.
//
// Auth: Supabase session cookie (portal) OR Bearer token (EASE).
// Body: { agent_id?: string }  — omit to scan all agents.
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
// Alert thresholds (days before expiration)
// ---------------------------------------------------------------------------
const LICENSE_THRESHOLDS = [60, 30, 7] as const;
const CE_THRESHOLDS = [60, 30, 7] as const;

interface LicenseAlert {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  notification_type: string;
  title: string;
  message: string;
  days_remaining: number;
  severity: 'critical' | 'warning' | 'info';
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const caller = await getAuthedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { agent_id } = body as { agent_id?: string };

    const admin = getAdminClient();
    const now = new Date();
    const alerts: LicenseAlert[] = [];

    // ------------------------------------------------------------------
    // 1. Fetch agent profiles with license data
    // ------------------------------------------------------------------
    let query = admin
      .from('profiles')
      .select('id, full_name, email, license_number, license_state, license_expiration_date, license_status, ce_hours_required, ce_hours_completed, ce_renewal_date, role')
      .in('role', ['agent', 'admin']);

    if (agent_id) {
      query = query.eq('id', agent_id);
    }

    const { data: agents, error: agentErr } = await query;

    if (agentErr) {
      console.error('[licenses/check] Error fetching agents:', agentErr);
      return NextResponse.json(
        { error: 'Failed to fetch agent profiles', detail: agentErr.message },
        { status: 500 }
      );
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json({
        scanned: 0,
        alerts_created: 0,
        message: 'No agents found to scan',
      });
    }

    console.log(`[licenses/check] Scanning ${agents.length} agent(s)`);

    // ------------------------------------------------------------------
    // 2. Check recently sent notifications to avoid duplicates
    // ------------------------------------------------------------------
    const agentIds = agents.map((a: any) => a.id);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentNotifs } = await admin
      .from('license_notifications')
      .select('agent_id, notification_type')
      .in('agent_id', agentIds)
      .gte('created_at', thirtyDaysAgo);

    const sentKey = (agentId: string, type: string) => `${agentId}:${type}`;
    const alreadySent = new Set(
      (recentNotifs || []).map((n: any) => sentKey(n.agent_id, n.notification_type))
    );

    // ------------------------------------------------------------------
    // 3. Evaluate each agent
    // ------------------------------------------------------------------
    const statusUpdates: Array<{ id: string; license_status: string }> = [];

    for (const agent of agents) {
      const agentName = agent.full_name || 'Agent';
      const agentEmail = agent.email || '';

      // --- License expiration checks ---
      if (agent.license_expiration_date) {
        const expDate = new Date(agent.license_expiration_date);
        const daysUntilExp = Math.ceil(
          (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Already expired
        if (daysUntilExp < 0) {
          statusUpdates.push({ id: agent.id, license_status: 'expired' });

          const type = 'license_expired';
          if (!alreadySent.has(sentKey(agent.id, type))) {
            alerts.push({
              agent_id: agent.id,
              agent_name: agentName,
              agent_email: agentEmail,
              notification_type: type,
              title: 'License Expired',
              message: `Your real estate license (${agent.license_state || 'FL'}) expired on ${expDate.toLocaleDateString()}. You cannot practice until renewed. Contact DBPR immediately.`,
              days_remaining: daysUntilExp,
              severity: 'critical',
            });
          }
        }
        // Expiring soon — check thresholds
        else {
          for (const threshold of LICENSE_THRESHOLDS) {
            if (daysUntilExp <= threshold) {
              const status = daysUntilExp <= 7 ? 'expiring_soon' : 'active';
              statusUpdates.push({ id: agent.id, license_status: status });

              const type = `license_expiring_${threshold}` as string;
              if (!alreadySent.has(sentKey(agent.id, type))) {
                alerts.push({
                  agent_id: agent.id,
                  agent_name: agentName,
                  agent_email: agentEmail,
                  notification_type: type,
                  title: `License Expires in ${daysUntilExp} Days`,
                  message: `Your ${agent.license_state || 'FL'} real estate license expires on ${expDate.toLocaleDateString()}. ${
                    daysUntilExp <= 7
                      ? 'URGENT: Renew immediately to avoid suspension.'
                      : daysUntilExp <= 30
                        ? 'Please start the renewal process soon.'
                        : 'Plan ahead to ensure timely renewal.'
                  }`,
                  days_remaining: daysUntilExp,
                  severity: daysUntilExp <= 7 ? 'critical' : daysUntilExp <= 30 ? 'warning' : 'info',
                });
              }
              break; // Only the tightest threshold that applies
            }
          }

          // Active license with no alerts needed
          if (daysUntilExp > 60) {
            statusUpdates.push({ id: agent.id, license_status: 'active' });
          }
        }
      }

      // --- CE hours checks ---
      if (agent.ce_renewal_date && agent.ce_hours_required > 0) {
        const ceDate = new Date(agent.ce_renewal_date);
        const daysUntilCE = Math.ceil(
          (ceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const ceCompleted = agent.ce_hours_completed || 0;
        const ceRequired = agent.ce_hours_required || 14;
        const ceRemaining = ceRequired - ceCompleted;

        if (ceRemaining > 0 && daysUntilCE > 0) {
          for (const threshold of CE_THRESHOLDS) {
            if (daysUntilCE <= threshold) {
              const type = `ce_incomplete_${threshold}` as string;
              if (!alreadySent.has(sentKey(agent.id, type))) {
                alerts.push({
                  agent_id: agent.id,
                  agent_name: agentName,
                  agent_email: agentEmail,
                  notification_type: type,
                  title: `CE Hours Incomplete — ${daysUntilCE} Days Left`,
                  message: `You have completed ${ceCompleted}/${ceRequired} CE hours. ${ceRemaining.toFixed(1)} hours remaining before the ${ceDate.toLocaleDateString()} deadline.${
                    daysUntilCE <= 7 ? ' URGENT: Complete your CE immediately.' : ''
                  }`,
                  days_remaining: daysUntilCE,
                  severity: daysUntilCE <= 7 ? 'critical' : daysUntilCE <= 30 ? 'warning' : 'info',
                });
              }
              break;
            }
          }
        }
      }
    }

    console.log(`[licenses/check] Found ${alerts.length} new alert(s)`);

    // ------------------------------------------------------------------
    // 4. Batch update license_status on profiles
    // ------------------------------------------------------------------
    for (const update of statusUpdates) {
      await admin
        .from('profiles')
        .update({ license_status: update.license_status })
        .eq('id', update.id);
    }

    // ------------------------------------------------------------------
    // 5. Insert license_notifications records
    // ------------------------------------------------------------------
    if (alerts.length > 0) {
      const notifRows = alerts.map((a) => ({
        agent_id: a.agent_id,
        notification_type: a.notification_type,
        title: a.title,
        message: a.message,
        days_remaining: a.days_remaining,
        email_sent: false,
        push_sent: false,
      }));

      const { error: notifErr } = await admin
        .from('license_notifications')
        .insert(notifRows);

      if (notifErr) {
        console.error('[licenses/check] Error inserting license_notifications:', notifErr);
      }
    }

    // ------------------------------------------------------------------
    // 6. Create in-app notifications
    // ------------------------------------------------------------------
    let inAppCreated = 0;

    if (alerts.length > 0) {
      const inAppRows = alerts.map((a) => ({
        user_id: a.agent_id,
        type: 'admin_alert',
        status: 'unread',
        title: a.title,
        body: a.message,
        icon: a.severity === 'critical' ? '\u26A0\uFE0F' : a.severity === 'warning' ? '\u23F0' : '\u2139\uFE0F',
        color: a.severity === 'critical' ? '#E85D6A' : a.severity === 'warning' ? '#F5A623' : '#2E75B6',
        created_at: now.toISOString(),
      }));

      const { error: inAppErr } = await admin
        .from('notifications')
        .insert(inAppRows);

      if (inAppErr) {
        console.error('[licenses/check] Error creating in-app notifications:', inAppErr);
      } else {
        inAppCreated = inAppRows.length;
      }
    }

    // ------------------------------------------------------------------
    // 7. Queue push notifications
    // ------------------------------------------------------------------
    if (alerts.length > 0) {
      const pushRows = alerts
        .filter((a) => a.severity === 'critical' || a.severity === 'warning')
        .map((a) => ({
          user_id: a.agent_id,
          title: a.title,
          body: a.message,
          data: JSON.stringify({ type: 'license_alert', notification_type: a.notification_type }),
          status: 'pending',
          created_at: now.toISOString(),
        }));

      if (pushRows.length > 0) {
        const { error: pushErr } = await admin
          .from('push_notification_queue')
          .insert(pushRows);

        if (pushErr) {
          console.error('[licenses/check] Error queuing push notifications:', pushErr);
        }
      }
    }

    // ------------------------------------------------------------------
    // 8. Send emails for critical/warning alerts via SendGrid
    // ------------------------------------------------------------------
    let emailsSent = 0;

    if (process.env.SENDGRID_API_KEY && alerts.length > 0) {
      // Group alerts by agent for consolidated emails
      const alertsByAgent = new Map<string, LicenseAlert[]>();
      for (const alert of alerts) {
        if (alert.severity === 'critical' || alert.severity === 'warning') {
          if (!alertsByAgent.has(alert.agent_id)) {
            alertsByAgent.set(alert.agent_id, []);
          }
          alertsByAgent.get(alert.agent_id)!.push(alert);
        }
      }

      for (const [agentId, agentAlerts] of alertsByAgent) {
        const agent = agentAlerts[0];
        if (!agent.agent_email) continue;

        const alertListHtml = agentAlerts
          .map(
            (a) => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #E8ECF0;">
                <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;color:#fff;background:${
                  a.severity === 'critical' ? '#E85D6A' : '#F5A623'
                };">${a.severity.toUpperCase()}</span>
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #E8ECF0;font-weight:600;color:#1F4E78;">
                ${a.title}
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #E8ECF0;color:#555;">
                ${a.message}
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
          <tr>
            <td style="background:#1F4E78;padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                HartFelt Real Estate
              </h1>
              <p style="margin:6px 0 0;color:#A8C8E8;font-size:14px;">
                License & CE Alert
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#333;">
                Hello ${agent.agent_name},
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#333;">
                We've detected <strong>${agentAlerts.length} license/CE alert(s)</strong> that require your attention.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8ECF0;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                <tr style="background:#2E75B6;">
                  <th style="padding:10px 12px;text-align:left;color:#fff;font-size:13px;">Severity</th>
                  <th style="padding:10px 12px;text-align:left;color:#fff;font-size:13px;">Alert</th>
                  <th style="padding:10px 12px;text-align:left;color:#fff;font-size:13px;">Details</th>
                </tr>
                ${alertListHtml}
              </table>
              <p style="margin:0 0 20px;font-size:15px;color:#333;">
                Please take action as soon as possible. Visit the
                <a href="https://portal.hartfelt.com" style="color:#2E75B6;text-decoration:underline;">HartFelt Portal</a>
                or your EASE app to update your license information.
              </p>
              <p style="margin:0;font-size:13px;color:#999;">
                For Florida license renewals, visit
                <a href="https://www.myfloridalicense.com" style="color:#2E75B6;">myfloridalicense.com</a>
                or contact DBPR at (850) 487-1395.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#F4F6F8;padding:16px 32px;border-top:1px solid #E8ECF0;">
              <p style="margin:0;font-size:12px;color:#999;text-align:center;">
                HartFelt Real Estate &bull; License Compliance
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        try {
          await sgMail.send({
            to: agent.agent_email,
            from: { email: FROM_EMAIL, name: 'HartFelt Compliance' },
            subject: `License Alert: ${agentAlerts.length} item(s) require attention`,
            html: emailHtml,
          });
          emailsSent++;

          // Mark as email_sent in license_notifications
          await admin
            .from('license_notifications')
            .update({ email_sent: true })
            .eq('agent_id', agentId)
            .in('notification_type', agentAlerts.map((a) => a.notification_type));
        } catch (emailErr) {
          console.error(`[licenses/check] Email failed for ${agent.agent_email}:`, emailErr);
        }
      }
    }

    // ------------------------------------------------------------------
    // 9. Also notify brokers about critical agent license issues
    // ------------------------------------------------------------------
    let brokerNotifs = 0;
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical');

    if (criticalAlerts.length > 0) {
      // Get all broker/admin profiles
      const { data: brokers } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['admin', 'broker']);

      if (brokers && brokers.length > 0) {
        const brokerNotifRows = [];
        for (const broker of brokers) {
          for (const alert of criticalAlerts) {
            brokerNotifRows.push({
              user_id: broker.id,
              type: 'admin_alert',
              status: 'unread',
              title: `Agent License Alert: ${alert.agent_name}`,
              body: alert.message,
              icon: '\u26A0\uFE0F',
              color: '#E85D6A',
              created_at: now.toISOString(),
            });
          }
        }

        const { error: brokerErr } = await admin
          .from('notifications')
          .insert(brokerNotifRows);

        if (!brokerErr) {
          brokerNotifs = brokerNotifRows.length;
        }
      }
    }

    // ------------------------------------------------------------------
    // 10. Response
    // ------------------------------------------------------------------
    console.log(
      `[licenses/check] Complete: scanned=${agents.length} alerts=${alerts.length} emails=${emailsSent} broker_notifs=${brokerNotifs}`
    );

    return NextResponse.json({
      scanned: agents.length,
      alerts_created: alerts.length,
      in_app_notifications: inAppCreated,
      emails_sent: emailsSent,
      broker_notifications: brokerNotifs,
      alerts: alerts.map((a) => ({
        agent_id: a.agent_id,
        agent_name: a.agent_name,
        type: a.notification_type,
        severity: a.severity,
        days_remaining: a.days_remaining,
        title: a.title,
      })),
    });
  } catch (err) {
    console.error('[licenses/check] Unhandled error:', err);
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/licenses/check
// Returns license status overview for all agents (broker view)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const caller = await getAuthedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();

    // Verify caller is broker/admin
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.userId)
      .single();

    const { data: agents, error } = await admin
      .from('profiles')
      .select('id, full_name, email, license_number, license_state, license_expiration_date, license_status, ce_hours_required, ce_hours_completed, ce_renewal_date, role')
      .in('role', ['agent', 'admin'])
      .order('license_expiration_date', { ascending: true, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    const summary = {
      total: agents?.length || 0,
      active: 0,
      expiring_soon: 0,
      expired: 0,
      unknown: 0,
      ce_incomplete: 0,
    };

    const enriched = (agents || []).map((agent: any) => {
      let days_until_expiration = null;
      let ce_completion_pct = 0;

      if (agent.license_expiration_date) {
        const expDate = new Date(agent.license_expiration_date);
        days_until_expiration = Math.ceil(
          (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      if (agent.ce_hours_required > 0) {
        ce_completion_pct = Math.round(
          ((agent.ce_hours_completed || 0) / agent.ce_hours_required) * 100
        );
      } else {
        ce_completion_pct = 100;
      }

      // Tally
      if (days_until_expiration !== null && days_until_expiration < 0) {
        summary.expired++;
      } else if (days_until_expiration !== null && days_until_expiration <= 60) {
        summary.expiring_soon++;
      } else if (days_until_expiration !== null) {
        summary.active++;
      } else {
        summary.unknown++;
      }

      if (ce_completion_pct < 100 && agent.ce_renewal_date) {
        summary.ce_incomplete++;
      }

      return {
        ...agent,
        days_until_expiration,
        ce_completion_pct,
      };
    });

    return NextResponse.json({ summary, agents: enriched });
  } catch (err) {
    console.error('[licenses/check] GET error:', err);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
