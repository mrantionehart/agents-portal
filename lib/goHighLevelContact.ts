import axios from 'axios';

const GHL_API_URL = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

/**
 * Create a contact in Go High Level
 * This triggers the SMS workflow automatically
 */
export async function createGHLContact(
  firstName: string,
  lastName: string,
  email: string,
  phone: string
): Promise<string> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.warn('[GHL] Contact creation credentials not configured');
    return '';
  }

  try {
    console.log('[GHL] Creating contact for:', email);

    const response = await axios.post(
      `${GHL_API_URL}/contacts/`,
      {
        locationId: GHL_LOCATION_ID,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        source: 'Agent Onboarding',
      },
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
      }
    );

    const contactId = response.data.contact?.id;
    console.log('[GHL] ✓ Contact created with ID:', contactId);

    return contactId || '';
  } catch (error: any) {
    console.error('[GHL] Failed to create contact:', error.message);
    if (error.response) {
      console.error('[GHL] Response status:', error.response.status);
      console.error('[GHL] Response data:', error.response.data);
    }
    // Don't throw - let agent creation succeed even if GHL contact fails
    return '';
  }
}
