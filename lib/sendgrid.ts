import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'info@hartfeltrealestate.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export interface WelcomeEmailData {
  agentName: string;
  personalEmail: string;
  workspaceEmail: string;
  temporaryPassword: string;
  portalUrl: string;
}

/**
 * Send welcome email to new agent
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  try {
    const { agentName, personalEmail, workspaceEmail, temporaryPassword, portalUrl } = data;

    const htmlContent = `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1F4E78; border-bottom: 3px solid #2E75B6; padding-bottom: 10px;">
        Welcome to HartFelt Real Estate, ${agentName}!
      </h1>

      <p style="margin-top: 20px;">
        You didn't just join a brokerage. You joined a standard.
      </p>

      <p>
        At HartFelt Real Estate, we lead with precision, perform with excellence, and serve with heart.
        We do not just sell property. We help people make meaningful decisions with clarity, confidence, and care.
      </p>

      <p>
        <strong>Because at HartFelt, Choices Matter.</strong>
      </p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">

      <h2 style="color: #2E75B6;">Your Portal Access</h2>

      <p>Your agent account has been set up! Here are your login credentials:</p>

      <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #2E75B6; margin: 20px 0;">
        <p style="margin: 0;"><strong>Portal Email:</strong> ${workspaceEmail}</p>
        <p style="margin: 10px 0 0 0;"><strong>Temporary Password:</strong> ${temporaryPassword}</p>
      </div>

      <p style="margin-top: 20px;">
        <a href="${portalUrl}"
           style="background-color: #2E75B6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Sign In to Portal
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        <strong>Important:</strong> You will be required to change your password on first login.
      </p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">

      <h2 style="color: #2E75B6;">Getting Started</h2>

      <ol style="line-height: 1.8;">
        <li>Log in to the Portal using the credentials above</li>
        <li>Complete your profile with additional information</li>
        <li>Review onboarding documents and training materials</li>
        <li>Join your team and start connecting with your broker</li>
      </ol>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">

      <h2 style="color: #2E75B6;">Our Philosophy</h2>

      <p style="font-style: italic;">
        "Train smart. Close confident. Live local luxury."
      </p>

      <p>
        Every tool, training, and template inside HartFelt was built to help you become faster, sharper, and more credible.
      </p>

      <p>
        We are built differently. We do not rely on hype. We build trust. We know the neighborhoods. We study the details. We speak in results.
      </p>

      <p>
        If you bring the work ethic, we will provide the structure, support, and standard.
      </p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">

      <p style="color: #666; font-size: 14px;">
        Questions? Contact us at <a href="mailto:info@hartfeltrealestate.com">info@hartfeltrealestate.com</a>
      </p>

      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; color: #999; font-size: 12px;">
        From The Hart,<br>
        <strong>Antione Hart</strong><br>
        HartFelt Real Estate
      </p>
    </div>
  </body>
</html>
    `;

    const msg = {
      to: personalEmail,
      from: FROM_EMAIL,
      subject: `Welcome to HartFelt Real Estate - Your Agent Account is Ready`,
      html: htmlContent,
      text: `
Welcome to HartFelt Real Estate, ${agentName}!

Your Portal Email: ${workspaceEmail}
Temporary Password: ${temporaryPassword}

Log in here: ${portalUrl}

You will be required to change your password on first login.

From The Hart,
Antione Hart
HartFelt Real Estate
      `,
    };

    await sgMail.send(msg);
    console.log(`Welcome email sent to ${personalEmail}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    throw new Error('Unable to send welcome email');
  }
}

/**
 * Send approval notification email to agent
 */
export async function sendApprovalEmail(agentName: string, personalEmail: string, portalUrl: string): Promise<void> {
  try {
    const htmlContent = `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1F4E78;">Your Onboarding is Complete!</h1>

      <p>Hi ${agentName},</p>

      <p>Great news! Your onboarding documents have been reviewed and approved. You are now officially an active HartFelt agent.</p>

      <p>
        <a href="${portalUrl}"
           style="background-color: #2E75B6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Access Your Portal
        </a>
      </p>

      <p>If you have any questions, reach out to info@hartfeltrealestate.com</p>

      <p>Welcome to the HartFelt family!</p>
    </div>
  </body>
</html>
    `;

    const msg = {
      to: personalEmail,
      from: FROM_EMAIL,
      subject: `Welcome to HartFelt - Your Account is Active!`,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`Approval email sent to ${personalEmail}`);
  } catch (error) {
    console.error('Failed to send approval email:', error);
    throw new Error('Unable to send approval email');
  }
}

/**
 * Send rejection email to agent
 */
export async function sendRejectionEmail(
  agentName: string,
  personalEmail: string,
  reason: string
): Promise<void> {
  try {
    const htmlContent = `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1F4E78;">Application Status Update</h1>

      <p>Hi ${agentName},</p>

      <p>Thank you for your interest in joining HartFelt Real Estate. After reviewing your application, we are unable to move forward at this time.</p>

      <p><strong>Reason:</strong> ${reason}</p>

      <p>If you have any questions or would like to reapply, please contact us at info@hartfeltrealestate.com</p>

      <p>We appreciate your interest in HartFelt!</p>
    </div>
  </body>
</html>
    `;

    const msg = {
      to: personalEmail,
      from: FROM_EMAIL,
      subject: `HartFelt Real Estate - Application Status`,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`Rejection email sent to ${personalEmail}`);
  } catch (error) {
    console.error('Failed to send rejection email:', error);
    throw new Error('Unable to send rejection email');
  }
}

/**
 * Send TC creation request notification to admins
 */
export async function sendTCCreationRequestNotification(data: {
  agentName: string;
  agentEmail: string;
  tcName: string;
  tcEmail: string;
  commissionSplit: number;
  brokerName: string;
  brokerEmail: string;
  approvalUrl: string;
  recipients: string[];
}): Promise<void> {
  try {
    const {
      agentName,
      agentEmail,
      tcName,
      tcEmail,
      commissionSplit,
      brokerName,
      brokerEmail,
      approvalUrl,
      recipients,
    } = data;

    const htmlContent = `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1F4E78; border-bottom: 3px solid #2E75B6; padding-bottom: 10px;">
        New Transaction Coordinator Creation Request
      </h1>

      <p style="margin-top: 20px;">A new Transaction Coordinator creation request has been submitted and is pending your approval.</p>

      <div style="background-color: #f5f5f5; padding: 20px; border-left: 4px solid #2E75B6; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #2E75B6; margin-top: 0;">Request Details</h3>

        <p style="margin: 10px 0;"><strong>Requesting Agent:</strong> ${agentName} (${agentEmail})</p>
        <p style="margin: 10px 0;"><strong>Agent's Broker:</strong> ${brokerName} (${brokerEmail})</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">

        <h3 style="color: #2E75B6; margin-top: 0;">Transaction Coordinator Details</h3>

        <p style="margin: 10px 0;"><strong>TC Name:</strong> ${tcName}</p>
        <p style="margin: 10px 0;"><strong>TC Email:</strong> ${tcEmail}</p>
        <p style="margin: 10px 0;"><strong>Commission Split:</strong> ${commissionSplit}%</p>
      </div>

      <p style="margin-top: 20px; text-align: center;">
        <a href="${approvalUrl}"
           style="background-color: #2E75B6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Review & Approve Request
        </a>
      </p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">

      <p style="color: #666; font-size: 14px;">
        This email was sent to you because you are listed as an administrator for TC creation requests.
      </p>

      <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ccc; color: #999; font-size: 12px;">
        From The Hart,<br>
        <strong>HartFelt Real Estate</strong>
      </p>
    </div>
  </body>
</html>
    `;

    // Send to all recipients
    for (const recipient of recipients) {
      const msg = {
        to: recipient,
        from: FROM_EMAIL,
        subject: `New TC Creation Request - Action Required: ${tcName}`,
        html: htmlContent,
        text: `
New Transaction Coordinator Creation Request

Requesting Agent: ${agentName} (${agentEmail})
Agent's Broker: ${brokerName} (${brokerEmail})

Transaction Coordinator Details:
Name: ${tcName}
Email: ${tcEmail}
Commission Split: ${commissionSplit}%

Review and approve this request at: ${approvalUrl}

From The Hart,
HartFelt Real Estate
        `,
      };

      await sgMail.send(msg);
      console.log(`TC creation request notification sent to ${recipient}`);
    }
  } catch (error) {
    console.error('Failed to send TC creation request notification:', error);
    throw new Error('Unable to send TC creation request notification');
  }
}
