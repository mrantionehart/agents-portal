import { createClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send Expo push notifications to specific users.
 * Queries push_notification_tokens table for active tokens, then sends via Expo Push API.
 *
 * @param userIds - Array of user IDs to notify (their active tokens will be looked up)
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Optional data payload (type, related IDs, etc.)
 * @param excludeUserId - Optional user ID to exclude (e.g. the sender)
 */
export async function sendExpoPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, any> = {},
  excludeUserId?: string
) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = admin
      .from('push_notification_tokens')
      .select('expo_push_token')
      .eq('is_active', true);

    if (userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId);
    }

    const { data: tokens, error } = await query;

    if (error || !tokens || tokens.length === 0) {
      return { sent: 0 };
    }

    const tokenList = tokens
      .map((t: any) => t.expo_push_token)
      .filter((t: string) => t && t.startsWith('ExponentPushToken'));

    if (tokenList.length === 0) return { sent: 0 };

    return await sendExpoPush(tokenList, title, body, data);
  } catch (err) {
    console.error('[push-notifications] Error:', err);
    return { sent: 0 };
  }
}

/**
 * Send Expo push notifications to ALL active tokens (broadcast).
 * Optionally exclude a specific user (e.g. the sender).
 */
export async function sendExpoPushBroadcast(
  title: string,
  body: string,
  data: Record<string, any> = {},
  excludeUserId?: string
) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = admin
      .from('push_notification_tokens')
      .select('expo_push_token')
      .eq('is_active', true);

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId);
    }

    const { data: tokens, error } = await query;

    if (error || !tokens || tokens.length === 0) {
      return { sent: 0 };
    }

    const tokenList = tokens
      .map((t: any) => t.expo_push_token)
      .filter((t: string) => t && t.startsWith('ExponentPushToken'));

    if (tokenList.length === 0) return { sent: 0 };

    return await sendExpoPush(tokenList, title, body, data);
  } catch (err) {
    console.error('[push-notifications] Broadcast error:', err);
    return { sent: 0 };
  }
}

/**
 * Low-level: send to a list of Expo push tokens via the Expo Push API.
 * Handles batching (max 100 per request).
 */
async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default' as const,
    title,
    body,
    data,
  }));

  // Expo accepts batches of up to 100
  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  let totalSent = 0;
  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      if (response.ok) {
        totalSent += chunk.length;
      }
    } catch (err) {
      console.error('[push-notifications] Expo API error:', err);
    }
  }

  return { sent: totalSent };
}
