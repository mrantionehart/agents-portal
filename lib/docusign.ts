import axios from 'axios';
import jwt from 'jsonwebtoken';
import { DocuSignEnvelope } from './types';

const DOCUSIGN_API_URL = process.env.DOCUSIGN_API_URL;
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
const DOCUSIGN_CLIENT_ID = process.env.DOCUSIGN_CLIENT_ID;

// Load RSA private key from environment variable
const DOCUSIGN_RSA_PRIVATE_KEY = process.env.DOCUSIGN_PRIVATE_KEY;

let cachedAccessToken: string | null = null;
let tokenExpiryTime: number | null = null;

/**
 * Get DocuSign access token using JWT flow
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime - 300000) {
    return cachedAccessToken;
  }

  try {
    console.log('[DocuSign] Requesting access token via JWT...');

    // Extract base URL from API_URL (remove /v2.1 or similar paths)
    const baseUrl = DOCUSIGN_API_URL?.replace(/\/v\d+\.?\d*\/?$/, '') || 'https://account-d.docusign.com';

    // Create JWT token for DocuSign OAuth
    const jwtToken = jwt.sign(
      {
        iss: DOCUSIGN_CLIENT_ID,
        sub: DOCUSIGN_ACCOUNT_ID,  // Use Account ID as subject
        aud: baseUrl,  // Audience should be the base URL, not the token endpoint
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      DOCUSIGN_RSA_PRIVATE_KEY,
      { algorithm: 'RS256' }
    );

    // Exchange JWT for access token
    const formData = new URLSearchParams();
    formData.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    formData.append('assertion', jwtToken);

    const tokenUrl = `${baseUrl}/oauth/token`;
    console.log('[DocuSign] Token endpoint:', tokenUrl);

    const response = await axios.post(tokenUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('[DocuSign] ✓ Access token obtained');
    cachedAccessToken = response.data.access_token;
    tokenExpiryTime = Date.now() + response.data.expires_in * 1000;

    return cachedAccessToken;
  } catch (error: any) {
    console.error('[DocuSign] Failed to get access token:', error.message);
    if (error.response) {
      console.error('[DocuSign] Response status:', error.response.status);
      console.error('[DocuSign] Response data:', error.response.data);
    }
    throw new Error('Unable to authenticate with DocuSign');
  }
}

/**
 * Send DocuSign envelope with PDF
 */
export async function sendDocuSignEnvelope(
  agentEmail: string,
  agentName: string,
  pdfBase64: string,
  webhookUrl: string
): Promise<DocuSignEnvelope> {
  try {
    const accessToken = await getAccessToken();

    const envelopeDefinition = {
      emailSubject: `HartFelt Real Estate - Onboarding Documents for ${agentName}`,
      emailBlurb: `Please sign your onboarding documents to complete your HartFelt Real Estate agent setup.`,
      documents: [
        {
          documentBase64: pdfBase64,
          name: 'HartFelt_Onboarding_Packet.pdf',
          fileFormat: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: agentEmail,
            name: agentName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: '1',
                  xPosition: '100',
                  yPosition: '100',
                },
              ],
            },
          },
        ],
      },
      status: 'sent',
      eventNotification: {
        url: webhookUrl,
        loggingEnabled: true,
        requireAcknowledgment: false,
        deliveryMode: 'SIM',
        envelopeEvents: [
          {
            envelopeEventStatusCode: 'sent',
            includeDocuments: false,
          },
          {
            envelopeEventStatusCode: 'delivered',
            includeDocuments: false,
          },
          {
            envelopeEventStatusCode: 'signed',
            includeDocuments: true,
          },
          {
            envelopeEventStatusCode: 'completed',
            includeDocuments: true,
          },
          {
            envelopeEventStatusCode: 'declined',
            includeDocuments: false,
          },
          {
            envelopeEventStatusCode: 'voided',
            includeDocuments: false,
          },
        ],
      },
    };

    console.log('[DocuSign] Sending envelope for:', agentEmail);
    const response = await axios.post(
      `${DOCUSIGN_API_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
      envelopeDefinition,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[DocuSign] ✓ Envelope sent with ID:', response.data.envelopeId);
    return {
      envelopeId: response.data.envelopeId,
      status: 'sent',
      statusDateTime: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('[DocuSign] Failed to send envelope:', error.message);
    if (error.response) {
      console.error('[DocuSign] Response status:', error.response.status);
      console.error('[DocuSign] Response data:', error.response.data);
    }
    throw new Error('Unable to send DocuSign envelope');
  }
}

/**
 * Get envelope status from DocuSign
 */
export async function getEnvelopeStatus(envelopeId: string): Promise<DocuSignEnvelope> {
  try {
    const accessToken = await getAccessToken();

    const response = await axios.get(
      `${DOCUSIGN_API_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return {
      envelopeId: response.data.envelopeId,
      status: response.data.status,
      statusDateTime: response.data.statusDateTime,
      documentStatuses: response.data.documentStatuses,
    };
  } catch (error) {
    console.error('Failed to get envelope status:', error);
    throw new Error('Unable to fetch envelope status');
  }
}

/**
 * Get signed document from DocuSign
 */
export async function getSignedDocument(envelopeId: string): Promise<Buffer> {
  try {
    const accessToken = await getAccessToken();

    const response = await axios.get(
      `${DOCUSIGN_API_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}/documents/combined`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'arraybuffer',
      }
    );

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Failed to get signed document:', error);
    throw new Error('Unable to fetch signed document');
  }
}
