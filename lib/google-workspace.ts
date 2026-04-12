import axios from 'axios';

const GOOGLE_API_URL = 'https://www.googleapis.com/admin/directory/v1';
const GOOGLE_OAUTH_URL = 'https://oauth2.googleapis.com/token';
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_CLIENT_ID = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID;
const GOOGLE_ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL;

let cachedAccessToken: string | null = null;
let tokenExpiryTime: number | null = null;

/**
 * Get Google API access token using domain-wide delegation
 */
async function getGoogleAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime - 300000) {
    return cachedAccessToken;
  }

  try {
    // In production, you would use a service account JSON key to generate a JWT
    // For now, we'll use a simplified approach that requires manual OAuth setup
    // This is a limitation of the organization policy blocking JSON key creation

    console.warn('Note: Google API token generation requires JWT with service account key');
    console.warn('Since JSON keys are blocked by organization policy, you need to:');
    console.warn('1. Generate access token manually from Google Cloud Console');
    console.warn('2. Or implement OAuth 2.0 flow for domain-wide delegation');

    throw new Error('Google API access requires service account JSON key or OAuth configuration');
  } catch (error) {
    console.error('Failed to get Google access token:', error);
    throw new Error('Unable to authenticate with Google Workspace API');
  }
}

/**
 * Create a Google Workspace user account
 */
export async function createGoogleWorkspaceUser(
  firstName: string,
  lastName: string,
  temporaryPassword: string
): Promise<{ email: string; userId: string }> {
  try {
    const accessToken = await getGoogleAccessToken();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hartfeltrealestate.com`;

    const userDefinition = {
      primaryEmail: email,
      firstName: firstName,
      lastName: lastName,
      password: temporaryPassword,
      changePasswordAtNextLogin: true,
      orgUnitPath: '/',
      suspended: false,
      customSchemas: {
        agentInfo: {
          role: 'real_estate_agent',
          onboardingDate: new Date().toISOString(),
        },
      },
    };

    const response = await axios.post(
      `${GOOGLE_API_URL}/users`,
      userDefinition,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          domain: 'hartfeltrealestate.com',
        },
      }
    );

    return {
      email: response.data.primaryEmail,
      userId: response.data.id,
    };
  } catch (error) {
    console.error('Failed to create Google Workspace user:', error);
    throw new Error('Unable to create Google Workspace account');
  }
}

/**
 * Get user info from Google Workspace
 */
export async function getGoogleWorkspaceUser(email: string): Promise<any> {
  try {
    const accessToken = await getGoogleAccessToken();

    const response = await axios.get(
      `${GOOGLE_API_URL}/users/${email}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Failed to get Google Workspace user:', error);
    throw new Error('Unable to fetch Google Workspace user information');
  }
}

/**
 * Deactivate/suspend a Google Workspace user
 */
export async function suspendGoogleWorkspaceUser(email: string): Promise<void> {
  try {
    const accessToken = await getGoogleAccessToken();

    await axios.put(
      `${GOOGLE_API_URL}/users/${email}`,
      { suspended: true },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Failed to suspend Google Workspace user:', error);
    throw new Error('Unable to deactivate Google Workspace account');
  }
}

/**
 * Generate temporary password for Google Workspace user
 */
export function generateTemporaryPassword(): string {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
