import axios from 'axios';

const TEXTMAGIC_API_URL = 'https://rest-api.textmagic.com/api/v2';
const TEXTMAGIC_USERNAME = process.env.TEXTMAGIC_USERNAME;
const TEXTMAGIC_API_KEY = process.env.TEXTMAGIC_API_KEY;

interface SendSMSOptions {
  phone: string;
  message: string;
}

/**
 * Send SMS via TextMagic API v2
 */
export async function sendSMS({ phone, message }: SendSMSOptions): Promise<boolean> {
  try {
    if (!TEXTMAGIC_USERNAME || !TEXTMAGIC_API_KEY) {
      console.warn('TextMagic credentials not configured');
      return false;
    }

    console.log('[TextMagic] Sending SMS...');
    console.log('[TextMagic] Phone:', phone);
    console.log('[TextMagic] Message length:', message.length);

    // Create form data for TextMagic API (form-encoded, not JSON)
    const formData = new URLSearchParams();
    formData.append('phones', phone);
    formData.append('text', message);

    const response = await axios.post(
      `${TEXTMAGIC_API_URL}/messages/send`,
      formData,
      {
        auth: {
          username: TEXTMAGIC_USERNAME,
          password: TEXTMAGIC_API_KEY,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('[TextMagic] Response status:', response.status);
    console.log('[TextMagic] Response data:', response.data);

    if (response.status === 200 || response.status === 201) {
      console.log(`[TextMagic] ✓ SMS sent successfully to ${phone}`);
      return true;
    } else {
      console.error('[TextMagic] Unexpected response status:', response.status);
      return false;
    }
  } catch (error: any) {
    console.error('[TextMagic] Error:', error.message);
    if (error.response) {
      console.error('[TextMagic] Response status:', error.response.status);
      console.error('[TextMagic] Response data:', error.response.data);
    }
    return false;
  }
}

/**
 * Send agent onboarding SMS
 */
export async function sendAgentOnboardingSMS(
  phone: string,
  email: string
): Promise<boolean> {
  const message = `Welcome to HartFelt Real Estate! Your onboarding documents have been sent to ${email}. Please review and sign them to complete your onboarding. Because Choices Matter.`;

  return sendSMS({ phone, message });
}
