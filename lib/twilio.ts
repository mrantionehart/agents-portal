import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Send SMS via Twilio
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<void> {
  if (!accountSid || !authToken || !twilioPhoneNumber) {
    console.warn('[Twilio] SMS credentials not configured');
    return;
  }

  try {
    console.log('[Twilio] Sending SMS to:', phoneNumber);
    console.log('[Twilio] Message length:', message.length);

    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    console.log('[Twilio] ✓ SMS sent successfully. SID:', result.sid);
  } catch (error: any) {
    console.error('[Twilio] Failed to send SMS:', error.message);
    if (error.response) {
      console.error('[Twilio] Response status:', error.response.status);
      console.error('[Twilio] Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Send agent onboarding SMS
 */
export async function sendAgentOnboardingSMS(phoneNumber: string, email: string): Promise<void> {
  const message = `Welcome to HartFelt Real Estate! Your onboarding documents have been sent to ${email}. Please review and sign them to complete your onboarding. Because Choices Matter.`;

  await sendSMS(phoneNumber, message);
}
