import axios from 'axios';

const GHL_API_URL = 'https://rest.gohighlevel.com/v1';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

/**
 * Send SMS via Go High Level
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<void> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.warn('[GoHighLevel] SMS credentials not configured');
    return;
  }

  try {
    console.log('[GoHighLevel] Sending SMS...');
    console.log('[GoHighLevel] Phone:', phoneNumber);
    console.log('[GoHighLevel] Message length:', message.length);

    // Go High Level SMS API endpoint
    const response = await axios.post(
      `${GHL_API_URL}/conversations/messages`,
      {
        locationId: GHL_LOCATION_ID,
        contactId: null, // Will be created if needed
        type: 'SMS',
        message: message,
      },
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[GoHighLevel] ✓ SMS sent successfully');
  } catch (error: any) {
    console.error('[GoHighLevel] Failed to send SMS:', error.message);
    if (error.response) {
      console.error('[GoHighLevel] Response status:', error.response.status);
      console.error('[GoHighLevel] Response data:', error.response.data);
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
